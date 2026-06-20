import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Countdown } from "@/components/koth/countdown";
import { RankBadge } from "@/components/koth/rank-badge";
import { Avatar } from "@/components/koth/avatar";
import { formatValue, shortUnitLabel, getVideoSignedUrl } from "@/lib/koth-utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — KOTH" }] }),
  component: Leaderboard,
});

function Leaderboard() {
  const challengeQ = useQuery({
    queryKey: ["active-challenge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .eq("status", "active")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const c = challengeQ.data;

  const rowsQ = useQuery({
    queryKey: ["leaderboard", c?.id],
    enabled: !!c?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, user_id, self_reported_value, admin_verified_value, status, video_path, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
        )
        .eq("challenge_id", c!.id)
        .eq("is_active_entry", true)
        .neq("status", "disqualified");
      if (!data) return [];
      return data
        .map((r) => ({ ...r, val: Number(r.admin_verified_value ?? r.self_reported_value) }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 10);
    },
  });

  const [open, setOpen] = useState<null | { url: string; user: string }>(null);

  async function openVideo(path: string, user: string) {
    const url = await getVideoSignedUrl(path);
    if (url) setOpen({ url, user });
  }

  if (!c) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="label-broadcast text-muted-foreground">No active challenge</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-broadcast text-koth-white/60">Leaderboard</p>
            <h1 className="mt-1 text-xl font-bold">{c.title}</h1>
          </div>
          <Countdown target={c.ends_at} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card">
        {rowsQ.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !rowsQ.data || rowsQ.data.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No entries yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rowsQ.data.map((r, i) => {
              const p = (r as any).profiles;
              const rank = i + 1;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => openVideo(r.video_path, p?.username ?? "?")}
                    className="tap-44 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <RankBadge rank={rank} size="md" />
                    <Avatar name={p?.display_name ?? p?.username ?? "?"} avatarPath={p?.avatar_url} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{p?.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{p?.username}</p>
                    </div>
                    <div className="text-right">
                      <div className="mono-stat text-base font-bold text-foreground">
                        {formatValue(r.val, c.unit_type, c.unit_label)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {shortUnitLabel(c.unit_type, c.unit_label)}
                      </div>
                    </div>
                    {r.status === "pending_review" && (
                      <span className="pill ml-1 bg-koth-pr-bg text-koth-pr-text">pending</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-md p-0">
          <DialogTitle className="sr-only">Video by @{open?.user}</DialogTitle>
          {open && (
            <video src={open.url} controls autoPlay playsInline className="aspect-[9/16] w-full bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
