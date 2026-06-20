import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Countdown } from "@/components/koth/countdown";
import { RankBadge } from "@/components/koth/rank-badge";
import { Avatar } from "@/components/koth/avatar";
import { formatValue, shortUnitLabel } from "@/lib/koth-utils";
import { TikTokPlayer, type PlayerItem } from "@/components/koth/tiktok-player";
import { Crown, Play, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — KOTH" }] }),
  component: Leaderboard,
});

function isNew(ts: string | null | undefined) {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < 60 * 60 * 1000;
}

function shortRel(ts: string) {
  return formatDistanceToNowStrict(new Date(ts), { addSuffix: true })
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d");
}

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
          "id, user_id, self_reported_value, admin_verified_value, status, video_path, submitted_at, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
        )
        .eq("challenge_id", c!.id)
        .eq("is_active_entry", true)
        .eq("status", "verified");
      if (!data) return [];
      return data
        .map((r) => ({ ...r, val: Number(r.admin_verified_value ?? r.self_reported_value) }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 10);
    },
  });

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);

  const rows = rowsQ.data ?? [];
  const items: PlayerItem[] = rows.map((r: any) => ({
    id: r.id,
    video_path: r.video_path,
    value: r.val,
    unit_type: c?.unit_type,
    unit_label: c?.unit_label,
    challenge_title: c?.title ?? null,
    user: {
      id: r.user_id,
      username: r.profiles?.username ?? "user",
      display_name: r.profiles?.display_name,
      avatar_url: r.profiles?.avatar_url,
    },
  }));

  function openVideoAt(i: number) {
    setPlayerIndex(i);
    setPlayerOpen(true);
  }

  if (!c) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <Trophy className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 label-broadcast text-muted-foreground">No active challenge</p>
        <p className="mt-1 text-sm text-foreground">A new hill drops soon. Stand by.</p>
      </div>
    );
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-4">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-4 text-koth-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-broadcast text-koth-white/60">Leaderboard</p>
            <h1 className="mt-0.5 truncate text-lg font-bold">{c.title}</h1>
            <p className="mt-0.5 text-[11px] text-koth-white/60">
              {rows.length} {rows.length === 1 ? "competitor" : "competitors"} on the hill
            </p>
          </div>
          <Countdown target={c.ends_at} />
        </div>
      </section>

      {rowsQ.isLoading ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <Crown className="mx-auto h-8 w-8 text-koth-red" aria-hidden />
          <p className="mt-3 text-base font-bold text-foreground">No entries yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to claim the hill.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <section className="grid grid-cols-3 gap-2">
            {[1, 0, 2].map((podiumPos) => {
              const r: any = podium[podiumPos];
              const rank = podiumPos + 1;
              const heights = ["h-36", "h-28", "h-24"]; // 1st tallest, then 2nd, 3rd
              const heightCls = heights[podiumPos];
              const isFirst = rank === 1;
              const tile = isFirst
                ? "bg-gradient-to-b from-koth-red to-[color-mix(in_oklab,var(--color-koth-red)_70%,black)] text-koth-white border-koth-red"
                : rank === 2
                  ? "bg-koth-silver text-koth-black border-koth-silver"
                  : "bg-koth-bronze text-koth-white border-koth-bronze";
              const orderCls = podiumPos === 1 ? "order-1" : podiumPos === 0 ? "order-2" : "order-3";
              if (!r) {
                return (
                  <div
                    key={rank}
                    className={`${orderCls} ${heightCls} flex flex-col items-center justify-end rounded-2xl border border-dashed border-border bg-card p-2`}
                  >
                    <RankBadge rank={rank} size="sm" />
                    <p className="mt-1 text-[10px] text-muted-foreground">Open</p>
                  </div>
                );
              }
              const p = r.profiles;
              const idx = rows.findIndex((x: any) => x.id === r.id);
              return (
              <button
                  key={r.id}
                  onClick={() => openVideoAt(idx)}
                  className={`tap-44 ${orderCls} ${heightCls} relative flex flex-col items-center justify-end overflow-hidden rounded-2xl border p-2 text-center shadow-lg ${tile}`}
                >
                  {isFirst && (
                    <Crown
                      className="absolute -top-3 left-1/2 h-5 w-5 -translate-x-1/2 text-koth-red drop-shadow"
                      aria-hidden
                    />
                  )}
                  <Avatar
                    name={p?.display_name ?? p?.username ?? "?"}
                    avatarPath={p?.avatar_url}
                    size={isFirst ? 48 : 40}
                  />
                  <p className="mt-1 w-full truncate text-[11px] font-semibold opacity-90">
                    @{p?.username}
                  </p>
                  <p className="mono-stat w-full truncate text-sm font-bold leading-tight">
                    {formatValue(r.val, c.unit_type, c.unit_label)}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] font-bold">
                    <Play className="h-2.5 w-2.5" fill="currentColor" aria-hidden /> Tap to watch
                  </span>
                  {isNew(r.submitted_at) && (
                    <span className="absolute -top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-koth-white px-1.5 py-0.5 text-[9px] font-bold text-koth-red">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden /> NEW
                    </span>
                  )}
                </button>
              );
            })}
          </section>

          {/* Rest of the board */}
          {rest.length > 0 && (
            <section className="rounded-3xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {rest.map((r: any, i) => {
                  const p = r.profiles;
                  const rank = i + 4;
                  const idx = rows.findIndex((x: any) => x.id === r.id);
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => openVideoAt(idx)}
                        className="tap-44 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                      >
                        <RankBadge rank={rank} size="md" />
                        <Avatar
                          name={p?.display_name ?? p?.username ?? "?"}
                          avatarPath={p?.avatar_url}
                          size={36}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {p?.display_name}
                            </p>
                            {isNew(r.submitted_at) && (
                              <span className="pill bg-koth-red text-koth-white">NEW</span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            @{p?.username} · submitted {shortRel(r.submitted_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="mono-stat text-base font-bold text-foreground">
                            {formatValue(r.val, c.unit_type, c.unit_label)}
                          </div>
                          {shortUnitLabel(c.unit_type, c.unit_label) && (
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {shortUnitLabel(c.unit_type, c.unit_label)}
                            </div>
                          )}
                        </div>
                        <Play className="ml-1 h-4 w-4 text-muted-foreground" aria-hidden />
                        {r.status === "pending_review" && (
                          <span className="pill ml-1 bg-koth-pr-bg text-koth-pr-text">pending</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <TikTokPlayer
        items={items}
        startIndex={playerIndex}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />
    </div>
  );
}
