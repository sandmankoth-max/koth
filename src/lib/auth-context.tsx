import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { assertDeviceNotBanned, recordDeviceFingerprint } from "@/lib/device-fingerprint";
import { getAvatarSignedUrl, primeAvatarSignedUrl } from "@/lib/koth-utils";

/**
 * KOTH uses username + password auth (no email, no phone).
 * We synthesize a deterministic email so Supabase Auth can still issue sessions.
 * The "email" never leaves the app — users only ever see their username.
 */
const SYNTH_EMAIL_DOMAIN = "koth.local";
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${SYNTH_EMAIL_DOMAIN}`;

const PROFANITY = [
  "fuck","shit","bitch","cunt","nigger","nigga","faggot","fag","retard",
  "rape","rapist","slut","whore","dick","pussy","cock","asshole","kike",
  "chink","spic","tranny","pedo","pedophile","molest",
] as const;

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  date_of_birth: string;
  avatar_url: string | null;
  age_consent_ack_at: string;
  bio: string | null;
};

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isModerator: boolean;
  isStaff: boolean;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (input: {
    username: string;
    password: string;
    display_name: string;
    date_of_birth: string;
    age_consent: boolean;
    avatar_file?: File | null;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (_uid: string) => {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.rpc("get_my_profile" as any),
      supabase.from("user_roles").select("role").eq("user_id", _uid),
    ]);
    const profileRow = Array.isArray(p) ? (p[0] as any) : (p as any);
    if (profileRow && profileRow.banned) {
      await supabase.auth.signOut();
      setProfile(null);
      setIsAdmin(false);
      throw new Error("This account has been banned.");
    }
    const nextProfile = (profileRow as Profile) ?? null;
    setProfile(nextProfile);
    if (nextProfile?.avatar_url) void getAvatarSignedUrl(nextProfile.avatar_url);
    setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer to avoid deadlocking the auth callback.
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (username: string, password: string) => {
    await assertDeviceNotBanned();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) throw new Error(error.message.replace("Email", "Username"));
    if (data.user) recordDeviceFingerprint(data.user.id);
  }, []);

  const signUp: AuthState["signUp"] = useCallback(async (input) => {
    if (!input.age_consent) throw new Error("You must confirm the age statement to continue.");
    await assertDeviceNotBanned();
    const dob = new Date(input.date_of_birth);
    if (Number.isNaN(dob.getTime())) throw new Error("Invalid date of birth.");
    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears < 13) throw new Error("You must be 13 or older to use KOTH.");

    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(username)) {
      throw new Error("Username must be 3–16 chars: lowercase letters, numbers, underscore.");
    }
    const displayName = (input.display_name.trim() || username).slice(0, 20);
    if (displayName.length < 1 || displayName.length > 20) {
      throw new Error("Display name must be 1–20 characters.");
    }
    if (PROFANITY.some((w) => username.includes(w) || displayName.toLowerCase().includes(w))) {
      throw new Error("Username or display name contains disallowed language.");
    }
    if (input.password.length < 8 || input.password.length > 16) {
      throw new Error("Password must be 8–16 characters.");
    }
    if (!/[A-Z]/.test(input.password) || !/[0-9]/.test(input.password)) {
      throw new Error("Password must include at least one uppercase letter and one number.");
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password: input.password,
      options: {
        data: {
          username,
          display_name: displayName,
          date_of_birth: input.date_of_birth,
          age_consent_ack_at: new Date().toISOString(),
        },
      },
    });
    if (error) throw new Error(error.message);

    const newUserId = signUpData.user?.id;
    if (input.avatar_file && newUserId) {
      try {
        // Wait briefly for the profile row to be created by the DB trigger
        // so our UPDATE actually targets an existing row.
        for (let i = 0; i < 10; i++) {
          const { data: row } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", newUserId)
            .maybeSingle();
          if (row) break;
          await new Promise((r) => setTimeout(r, 200));
        }
        const f = input.avatar_file;
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${newUserId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("koth-avatars")
          .upload(path, f, { contentType: f.type, upsert: true });
        if (!upErr) {
          const { data: signed } = await supabase.storage.from("koth-avatars").createSignedUrl(path, 3600);
          primeAvatarSignedUrl(path, signed?.signedUrl ?? null);
          await supabase.from("profiles").update({ avatar_url: path }).eq("id", newUserId);
          // Refresh in-memory profile so the avatar shows immediately app-wide.
          await loadProfile(newUserId);
        }
      } catch {
        // non-fatal — user can set avatar later in profile
      }
    }
    if (newUserId) recordDeviceFingerprint(newUserId);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const value = useMemo<AuthState>(
    () => ({ session, user, profile, isAdmin, loading, signIn, signUp, signOut, refreshProfile }),
    [session, user, profile, isAdmin, loading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
