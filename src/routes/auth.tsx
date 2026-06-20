import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { Camera } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — KOTH" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode = "login" } = Route.useSearch();
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // login fields
  const [u, setU] = useState("");
  const [p, setP] = useState("");

  // signup fields
  const [su, setSu] = useState("");
  const [sp, setSp] = useState("");
  const [sd, setSd] = useState("");
  const [sdob, setSdob] = useState("");
  const [consent, setConsent] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isSignup = mode === "signup";

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        await signUp({
          username: su,
          password: sp,
          display_name: sd || su,
          date_of_birth: sdob,
          age_consent: consent,
          avatar_file: avatarFile,
        });
        toast.success("Welcome to KOTH");
      } else {
        await signIn(u, p);
      }
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-koth-black px-6 py-8 text-koth-white">
      <Link to="/" className="label-broadcast mb-8 text-koth-white/60">
        ← Back
      </Link>

      <div className="mb-6">
        <h1 className="label-broadcast text-2xl tracking-[0.14em] text-koth-white">
          {isSignup ? "Create account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-koth-white/60">
          {isSignup ? "Pick a username. No email needed." : "Sign in with your username and password."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignup ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="tap-44 relative inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-koth-white/20 bg-koth-white/5"
                aria-label="Add profile photo"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-7 w-7 text-koth-white/60" aria-hidden />
                )}
                <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-koth-red text-[10px] font-bold text-koth-white">
                  +
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={onPickAvatar}
              />
              <p className="text-xs text-koth-white/50">
                {avatarFile ? "Tap to change photo" : "Add a profile photo (optional)"}
              </p>
            </div>
            <Field label="Username" hint="3–16 chars, lowercase letters / numbers / underscore">
              <Input
                value={su}
                onChange={(e) => setSu(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="text"
                required
                minLength={3}
                maxLength={16}
                className="koth-input"
              />
            </Field>
            <Field label="Display name">
              <Input
                value={sd}
                onChange={(e) => setSd(e.target.value)}
                required
                maxLength={40}
                className="koth-input"
              />
            </Field>
            <Field label="Password" hint="8+ characters">
              <Input
                type="password"
                value={sp}
                onChange={(e) => setSp(e.target.value)}
                required
                minLength={8}
                className="koth-input"
              />
            </Field>
            <Field label="Date of birth" hint="You must be 13 or older to use KOTH">
              <Input
                type="date"
                value={sdob}
                onChange={(e) => setSdob(e.target.value)}
                required
                className="koth-input"
              />
            </Field>
            <label className="flex items-start gap-3 rounded-2xl border border-koth-white/15 bg-koth-white/5 p-4 text-sm leading-snug text-koth-white/85">
              <Checkbox
                checked={consent}
                onCheckedChange={(c) => setConsent(c === true)}
                className="mt-0.5"
              />
              <span>
                I am 13 or older. If I am under 18, I confirm I have a parent or guardian's permission to use
                this app, including submitting videos and being eligible for cash or gift card prizes.
              </span>
            </label>
          </>
        ) : (
          <>
            <Field label="Username">
              <Input
                value={u}
                onChange={(e) => setU(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                required
                className="koth-input"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={p}
                onChange={(e) => setP(e.target.value)}
                required
                className="koth-input"
              />
            </Field>
          </>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="tap-44 mt-2 h-12 rounded-full bg-koth-red text-base font-bold text-koth-white hover:bg-koth-red/90"
        >
          {busy ? "…" : isSignup ? "Create account" : "Log in"}
        </Button>

        <p className="mt-2 text-center text-sm text-koth-white/60">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <Link
            to="/auth"
            search={{ mode: isSignup ? "login" : "signup" }}
            className="font-bold text-koth-white underline"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="label-broadcast text-koth-white/70">{label}</Label>
      {children}
      {hint && <p className="text-xs text-koth-white/50">{hint}</p>}
    </div>
  );
}
