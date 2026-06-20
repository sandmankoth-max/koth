import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteOwnSubmission } from "@/lib/submissions.functions";
import { Countdown } from "@/components/koth/countdown";
import { RankBadge } from "@/components/koth/rank-badge";
import { ProfileAvatar } from "@/components/koth/profile-avatar";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import { formatValue, shortUnitLabel } from "@/lib/koth-utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WelcomeDialog } from "@/components/koth/welcome-dialog";
import { LiveActivity } from "@/components/koth/live-activity";
import { PositionCard } from "@/components/koth/position-card";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "KOTH — This week's challenge" }] }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const deleteSubmission = useServerFn(deleteOwnSubmission);
  const [deletingEntry, setDeletingEntry] = useState(false);

  const challengeQ = useQuery({
    queryKey: ["active-or-upcoming-challenge"],
    queryFn: async () => {
      const { data: active } = await supabase
        .from("challenges")
        .select("*")
        .eq("status", "active")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) return active;
      const { data: upcoming } = await supabase
        .from("challenges")
        .select("*")
        .eq("status", "upcoming")
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return upcoming;
    },
  });

  const myEntryQ = useQuery({
    queryKey: ["my-entry", challengeQ.data?.id, user?.id],
    enabled: !!challengeQ.data?.id && !!user?.id,
    queryFn: async () => {
      // Home shows the user's PUBLIC (prize-pool) entry only. Friends-only
      // uploads live on the profile / friends feed and don't affect rank.
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("challenge_id", challengeQ.data!.id)
        .eq("user_id", user!.id)
        .eq("visibility", "public")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });


  const c = challengeQ.data;

  async function deleteMyEntry() {
    if (!myEntryQ.data) return;
    if (!window.confirm("Delete your video and remove it from the leaderboard?")) return;
    setDeletingEntry(true);
    try {
      await deleteSubmission({ data: { submissionId: myEntryQ.data.id } });
      toast.success("Video deleted");
      await queryClient.invalidateQueries({ queryKey: ["my-entry", c?.id, user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["my-rank", c?.id, user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["top3", c?.id] });
      await queryClient.invalidateQueries({ queryKey: ["leaderboard", c?.id] });
      await queryClient.invalidateQueries({ queryKey: ["feed", c?.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingEntry(false);
    }
  }

  if (challengeQ.isLoading) return <Skeleton />;

  if (!c) {
    return (
      <div className="space-y-4">
        <RankNotifications />
        <EmptyState />
      </div>
    );
  }

  if (c.status === "upcoming") {
    const startsAt = new Date(c.starts_at);
    const fmt = startsAt.toLocaleString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <div className="space-y-4">
        <WelcomeDialog />
        <RankNotifications />
        <section className="koth-stripe relative overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
          <p className="label-broadcast text-koth-white/60">This week's challenge</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">New challenge drops {fmt}</h1>
          <p className="mt-3 text-sm text-koth-white/80">
            The next challenge is locked in. You'll be notified the moment it goes live.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <p className="label-broadcast text-koth-white/60">Starts in</p>
            <Countdown target={c.starts_at} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WelcomeDialog />
      <RankNotifications />

      {/* Challenge hero card — tightened */}
      <section className="koth-stripe relative overflow-hidden rounded-3xl bg-koth-black p-4 text-koth-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-broadcast text-koth-white/60">This week's challenge</p>
            <h1 className="mt-0.5 truncate text-xl font-bold leading-tight">{c.title}</h1>
          </div>
          <Countdown target={c.ends_at} />
        </div>
        {c.description && (
          <p className="mt-2 line-clamp-2 text-xs text-koth-white/80">{c.description}</p>
        )}
        {c.safety_note && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-koth-pr-bg px-2.5 py-1.5 text-koth-pr-text">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className="text-[11px] font-medium">{c.safety_note}</span>
          </div>
        )}

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <PrizeChip label="1st" amount={Number(c.prize_first)} rank={1} />
          <PrizeChip label="2nd" amount={Number(c.prize_second)} rank={2} />
          <PrizeChip label="3rd" amount={Number(c.prize_third)} rank={3} />
        </div>
      </section>

      {/* Live activity feed */}
      <LiveActivity challengeId={c.id} unitType={c.unit_type} unitLabel={c.unit_label} />



      {/* Your position */}
      {user && (
        <PositionCard
          challengeId={c.id}
          userId={user.id}
          hasEntry={!!myEntryQ.data}
          myValue={
            myEntryQ.data
              ? Number(myEntryQ.data.admin_verified_value ?? myEntryQ.data.self_reported_value)
              : null
          }
          unitType={c.unit_type}
          unitLabel={c.unit_label}
        />
      )}

      {/* My entry status + delete control */}
      {myEntryQ.data && (
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="label-broadcast text-muted-foreground">Your time</p>
              <p className="mono-stat mt-0.5 text-2xl font-bold text-foreground">
                {formatValue(
                  Number(myEntryQ.data.admin_verified_value ?? myEntryQ.data.self_reported_value),
                  c.unit_type,
                  c.unit_label,
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {myEntryQ.data.status === "pending_review" && "Awaiting admin verification"}
                {myEntryQ.data.status === "verified" && "Verified"}
                {myEntryQ.data.status === "flagged" && "Flagged for review"}
                {myEntryQ.data.status === "disqualified" && "Disqualified"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deletingEntry}
              onClick={deleteMyEntry}
              className="tap-44 rounded-full border-koth-red text-koth-red hover:bg-koth-red hover:text-koth-white"
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Delete
            </Button>
          </div>
        </section>
      )}

      {/* Top 3 preview */}
      <TopThreePreview challengeId={c.id} unitType={c.unit_type} unitLabel={c.unit_label} />
    </div>
  );
}

function PrizeChip({ label, amount, rank }: { label: string; amount: number; rank: number }) {
  const palette =
    rank === 1
      ? "bg-koth-red text-koth-white"
      : rank === 2
        ? "bg-koth-silver text-koth-black"
        : "bg-koth-bronze text-koth-white";
  return (
    <div className={`rounded-xl px-3 py-2 ${palette}`}>
      <p className="label-broadcast text-[10px] opacity-80">{label}</p>
      <p className="mono-stat text-lg font-bold leading-tight">${amount}</p>
    </div>
  );
}

function TopThreePreview({
  challengeId,
  unitType,
  unitLabel,
}: {
  challengeId: string;
  unitType: string;
  unitLabel: string;
}) {
  const { data } = useQuery({
    queryKey: ["top3", challengeId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("submissions")
        .select(
          "id, user_id, self_reported_value, admin_verified_value, status, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
        )
        .eq("challenge_id", challengeId)
        .eq("is_active_entry", true)
        .eq("status", "verified");
      if (!rows) return [];
      return rows
        .map((r) => ({
          ...r,
          val: Number(r.admin_verified_value ?? r.self_reported_value),
        }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 3);
    },
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-broadcast text-muted-foreground">Top 3 right now</p>
        <Link to="/leaderboard" className="label-broadcast text-koth-red">
          Full board →
        </Link>
      </div>
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No verified entries yet. Be first.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((r, i) => {
            const p = (r as any).profiles;
            return (
              <li key={r.id} className="flex items-center gap-3">
                <RankBadge rank={i + 1} size="md" />
                <ProfileAvatar
                  username={p?.username}
                  name={p?.display_name ?? p?.username ?? "?"}
                  avatarPath={p?.avatar_url}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p?.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p?.username}</p>
                </div>
                <div className="mono-stat text-base font-bold text-foreground">
                  {formatValue(r.val, unitType, unitLabel)}
                  {shortUnitLabel(unitType, unitLabel) && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {shortUnitLabel(unitType, unitLabel)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
      <p className="label-broadcast text-muted-foreground">No active challenge</p>
      <h2 className="mt-2 text-lg font-bold text-foreground">Stand by</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A new challenge drops every Monday at 10am.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-44 animate-pulse rounded-3xl bg-muted" />
      <div className="h-28 animate-pulse rounded-3xl bg-muted" />
    </div>
  );
}

function RankNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<{ id: string; type: string; payload: any }[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("notifications")
      .select("id, type, payload")
      .eq("user_id", user.id)
      .eq("read", false)
      .in("type", ["overtaken", "podium_lost", "podium_gained"])
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (active) setItems(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function dismiss(id: string) {
    setItems((cur) => cur.filter((x) => x.id !== id));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {items.map((n) => {
        const palette =
          n.type === "podium_lost"
            ? "bg-koth-red text-koth-white"
            : n.type === "podium_gained"
              ? "bg-koth-pr-bg text-koth-pr-text"
              : "bg-koth-black text-koth-white";
        const msg =
          n.type === "podium_gained"
            ? `You're on the podium — #${n.payload?.new_rank}`
            : n.type === "podium_lost"
              ? `@${n.payload?.overtaken_by_username} knocked you off the podium`
              : `@${n.payload?.overtaken_by_username} just passed you — you're #${n.payload?.new_rank}`;
        return (
          <div key={n.id} className={`flex items-center gap-2 rounded-2xl px-4 py-3 ${palette}`}>
            <p className="flex-1 text-sm font-semibold">{msg}</p>
            <button
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss"
              className="tap-44 -mr-2 inline-flex items-center justify-center rounded-full p-2 opacity-80 hover:opacity-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
