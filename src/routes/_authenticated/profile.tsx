import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { RankBadge } from "@/components/koth/rank-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, LogOut, Camera, FileText, ShieldCheck, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TikTokPlayer, type PlayerItem } from "@/components/koth/tiktok-player";
import { VideoThumb } from "@/components/koth/video-thumb";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — KOTH" }] }),
  component: Profile,
});

type Tab = "challenges" | "stats";

function Profile() {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<Tab>("challenges");
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(profile?.bio ?? "");

  useEffect(() => {
    setBioDraft(profile?.bio ?? "");
  }, [profile?.bio]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setUploading(true);
    try {
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("koth-avatars")
        .upload(path, f, { contentType: f.type, upsert: true });
      if (upErr) throw upErr;
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      await refreshProfile();
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveBio() {
    if (!user) return;
    const trimmed = bioDraft.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ bio: trimmed.length ? trimmed : null })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      await refreshProfile();
      toast.success("Bio saved");
      setEditingBio(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="tap-44 relative inline-flex items-center justify-center rounded-full"
            aria-label="Change avatar"
          >
            <Avatar
              name={profile?.display_name ?? profile?.username ?? "?"}
              avatarPath={profile?.avatar_url}
              size={72}
            />
            <span className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-koth-red text-koth-white">
              <Camera className="h-3.5 w-3.5" aria-hidden />
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
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{profile?.display_name}</h1>
            <p className="truncate text-sm text-koth-white/60">@{profile?.username}</p>
            {uploading && <p className="mt-1 label-broadcast text-koth-white/40">Uploading…</p>}
          </div>
        </div>

        {/* Bio */}
        <div className="mt-4">
          {editingBio ? (
            <div className="space-y-2">
              <Textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                placeholder="Tell people what you're about…"
                maxLength={160}
                rows={3}
                className="resize-none rounded-2xl bg-koth-white/10 text-sm text-koth-white placeholder:text-koth-white/40 border-koth-white/20"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBioDraft(profile?.bio ?? "");
                    setEditingBio(false);
                  }}
                  className="rounded-full border-koth-white/20 bg-transparent text-koth-white hover:bg-koth-white/10"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveBio}
                  className="rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingBio(true)}
              className="tap-44 flex w-full items-start gap-2 text-left text-sm text-koth-white/80"
            >
              <span className="flex-1">
                {profile?.bio || <span className="text-koth-white/40">Add a bio…</span>}
              </span>
              <Pencil className="mt-0.5 h-3.5 w-3.5 text-koth-white/40" />
            </button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-card p-1">
        <button
          onClick={() => setTab("challenges")}
          className={cn(
            "tap-44 rounded-full py-2 text-sm font-bold transition-colors",
            tab === "challenges" ? "bg-koth-red text-koth-white" : "text-muted-foreground",
          )}
        >
          Challenges
        </button>
        <button
          onClick={() => setTab("stats")}
          className={cn(
            "tap-44 rounded-full py-2 text-sm font-bold transition-colors",
            tab === "stats" ? "bg-koth-red text-koth-white" : "text-muted-foreground",
          )}
        >
          Stats
        </button>
      </div>

      {tab === "challenges" ? <ChallengesTab /> : <StatsTab />}

      <section className="rounded-3xl border border-border bg-card">
        <SettingRow to="/notifications" icon={<ShieldCheck className="h-4 w-4" aria-hidden />} label="Notifications" />
        <SettingRow to="/legal/rules" icon={<FileText className="h-4 w-4" aria-hidden />} label="Official Rules" />
        <SettingRow to="/legal/terms" icon={<FileText className="h-4 w-4" aria-hidden />} label="Terms of Service" />
        <SettingRow to="/legal/privacy" icon={<FileText className="h-4 w-4" aria-hidden />} label="Privacy Policy" />
        {isAdmin && (
          <SettingRow to="/admin" icon={<ShieldCheck className="h-4 w-4 text-koth-red" />} label="Admin panel" />
        )}
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="tap-44 flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-koth-red"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </button>
      </section>
    </div>
  );
}

function SettingRow({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="tap-44 flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 text-sm font-semibold text-foreground hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function ChallengesTab() {
  const { user, profile } = useAuth();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);

  const videosQ = useQuery({
    queryKey: ["my-videos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Show every saved video: the user's latest public attempt per
      // challenge (older publics were deleted on upload) plus the full
      // friends-only history (which never deletes prior attempts).
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, video_path, self_reported_value, admin_verified_value, submitted_at, visibility, is_active_entry, challenges(id, title, unit_type, unit_label)",
        )
        .eq("user_id", user!.id)
        .neq("status", "disqualified")
        .order("submitted_at", { ascending: false });
      return (data ?? []).filter(
        (s: any) => s.challenges && (s.visibility === "friends_only" || s.is_active_entry),
      );
    },
  });

  const items: PlayerItem[] = (videosQ.data ?? []).map((s: any) => ({
    id: s.id,
    video_path: s.video_path,
    value: Number(s.admin_verified_value ?? s.self_reported_value),
    unit_type: s.challenges?.unit_type,
    unit_label: s.challenges?.unit_label,
    challenge_title: s.challenges?.title,
    user: {
      id: user!.id,
      username: profile?.username ?? "you",
      display_name: profile?.display_name,
      avatar_url: profile?.avatar_url,
    },
  }));

  return (
    <section>
      {videosQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No videos yet. Your submissions will show up here.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((it, i) => (
            <VideoThumb
              key={it.id}
              videoPath={it.video_path}
              onClick={() => {
                setPlayerIndex(i);
                setPlayerOpen(true);
              }}
              badge={
                (videosQ.data?.[i] as any)?.visibility === "friends_only" ? (
                  <span className="rounded-full bg-koth-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-white">
                    Friends
                  </span>
                ) : null
              }
            />
          ))}
        </div>
      )}
      <TikTokPlayer
        items={items}
        startIndex={playerIndex}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />
    </section>
  );
}

function StatsTab() {
  const { user } = useAuth();
  const winsQ = useQuery({
    queryKey: ["wins", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("results")
        .select("rank, final_value, prize_amount, created_at, challenges(title, unit_type, unit_label, ends_at)")
        .eq("user_id", user!.id)
        .lte("rank", 3)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5">
      <CareerStats />

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="label-broadcast text-muted-foreground">Past wins</h2>
        {winsQ.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : winsQ.data && winsQ.data.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {winsQ.data.map((w, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <RankBadge rank={w.rank} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {(w as any).challenges?.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date((w as any).challenges?.ends_at ?? w.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="mono-stat text-sm font-bold text-koth-red">${Number(w.prize_amount)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No podium finishes yet. Your first win starts this week.
          </p>
        )}
      </section>
    </div>
  );
}

function CareerStats() {
  const { user } = useAuth();
  const statsQ = useQuery({
    queryKey: ["career-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [resultsRes, subsRes] = await Promise.all([
        supabase.from("results").select("rank, prize_amount").eq("user_id", user!.id),
        supabase
          .from("submissions")
          .select("challenge_id")
          .eq("user_id", user!.id)
          .eq("is_active_entry", true),
      ]);
      const results = resultsRes.data ?? [];
      const wins = results.filter((r) => r.rank === 1).length;
      const podiums = results.filter((r) => r.rank <= 3).length;
      const prize = results.reduce((s, r) => s + Number(r.prize_amount ?? 0), 0);
      const entered = new Set((subsRes.data ?? []).map((s) => s.challenge_id)).size;
      const best = results.length ? Math.min(...results.map((r) => r.rank)) : null;
      return { wins, podiums, prize, entered, best };
    },
  });
  const s = statsQ.data;
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h2 className="label-broadcast text-muted-foreground">Career stats</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Wins" value={s?.wins ?? 0} />
        <Stat label="Podiums" value={s?.podiums ?? 0} />
        <Stat label="Entered" value={s?.entered ?? 0} />
        <Stat label="Prize $" value={`$${s?.prize ?? 0}`} accent />
      </div>
      {s?.best != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Best finish: <span className="font-semibold text-foreground">#{s.best}</span>
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/40 px-3 py-2.5">
      <p className="label-broadcast text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("mono-stat mt-0.5 text-lg font-bold", accent ? "text-koth-red" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
