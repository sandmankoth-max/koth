import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { RankBadge } from "@/components/koth/rank-badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, LogOut, Camera, FileText, ShieldCheck, Play } from "lucide-react";
import { toast } from "sonner";
import { formatValue, getVideoSignedUrl } from "@/lib/koth-utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — KOTH" }] }),
  component: Profile,
});

function Profile() {
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{profile?.display_name}</h1>
            <p className="truncate text-sm text-koth-white/60">@{profile?.username}</p>
            {uploading && <p className="mt-1 label-broadcast text-koth-white/40">Uploading…</p>}
          </div>
        </div>
      </section>

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
            No podiums yet. Make this week count.
          </p>
        )}
      </section>

      <PastSubmissions />


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
