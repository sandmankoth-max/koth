import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatValue } from "@/lib/koth-utils";
import { RankBadge } from "@/components/koth/rank-badge";
import { TrendingUp, Video } from "lucide-react";

type Props = {
  challengeId: string;
  userId: string;
  hasEntry: boolean;
  myValue?: number | null;
  unitType: string;
  unitLabel: string;
};

export function PositionCard({
  challengeId,
  userId,
  hasEntry,
  myValue,
  unitType,
  unitLabel,
}: Props) {
  const { data } = useQuery({
    queryKey: ["position-board", challengeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("user_id, self_reported_value, admin_verified_value")
        .eq("challenge_id", challengeId)
        .eq("is_active_entry", true)
        .neq("status", "disqualified");
      return (data ?? [])
        .map((r) => ({
          user_id: r.user_id,
          val: Number(r.admin_verified_value ?? r.self_reported_value),
        }))
        .sort((a, b) => b.val - a.val);
    },
  });

  if (!data) {
    return (
      <section className="rounded-3xl border border-border bg-card p-4">
        <p className="label-broadcast text-muted-foreground">Your position</p>
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  const total = data.length;
  const leader = data[0];
  const myIdx = data.findIndex((r) => r.user_id === userId);
  const myRank = myIdx >= 0 ? myIdx + 1 : null;
  const podiumThreshold = data[2]?.val;

  if (!hasEntry || myRank == null) {
    return (
      <section className="rounded-3xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label-broadcast text-muted-foreground">Your position</p>
            <p className="mt-1 text-base font-bold text-foreground">Not entered yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {total === 0
                ? "Be the first to claim the hill."
                : `${total} ${total === 1 ? "player" : "players"} already in. Drop a time.`}
            </p>
          </div>
          <Link
            to="/record"
            className="tap-44 inline-flex items-center gap-1.5 rounded-full bg-koth-red px-4 py-2 text-sm font-bold text-koth-white"
          >
            <Video className="h-4 w-4" aria-hidden />
            Record
          </Link>
        </div>
      </section>
    );
  }

  const behindLeader = myRank > 1 ? leader.val - (myValue ?? 0) : null;
  const podiumGap =
    myRank > 3 && podiumThreshold != null ? podiumThreshold - (myValue ?? 0) + 0.01 : null;

  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <p className="label-broadcast text-muted-foreground">Your position</p>
      <div className="mt-2 flex items-center gap-3">
        <RankBadge rank={myRank} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            Currently #{myRank} of {total}
          </p>
          {myRank === 1 ? (
            <p className="mt-0.5 text-sm font-bold text-koth-red">
              You're on top. Defend the hill.
            </p>
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {behindLeader != null && behindLeader > 0
                ? `${formatValue(behindLeader, unitType, unitLabel)} behind 1st`
                : "Tied for 1st"}
            </p>
          )}
          {podiumGap != null && podiumGap > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" aria-hidden />
              {formatValue(podiumGap, unitType, unitLabel)} from the podium
            </p>
          )}
        </div>
        <Link
          to="/record"
          className="tap-44 inline-flex items-center gap-1.5 rounded-full border border-koth-red px-3 py-2 text-xs font-bold text-koth-red"
        >
          Try again
        </Link>
      </div>
    </section>
  );
}
