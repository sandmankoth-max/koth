import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ProfileAvatar } from "@/components/koth/profile-avatar";
import { formatValue } from "@/lib/koth-utils";
import { Activity } from "lucide-react";

type Props = {
  challengeId: string;
  unitType: string;
  unitLabel: string;
};

function relTime(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return "just now";
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true })
    .replace(" seconds", "s")
    .replace(" second", "s")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d");
}

export function LiveActivity({ challengeId, unitType, unitLabel }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["live-activity", challengeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, self_reported_value, admin_verified_value, submitted_at, status, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
        )
        .eq("challenge_id", challengeId)
        .eq("visibility", "public")
        .neq("status", "disqualified")
        .order("submitted_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <section className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-koth-red opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-koth-red" />
        </span>
        <p className="label-broadcast text-muted-foreground">Live activity</p>
      </div>
      {isLoading ? (
        <p className="py-2 text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-4 text-center">
          <Activity className="h-5 w-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Quiet so far. Be the first to make a move.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {data.map((s: any) => {
            const p = s.profiles;
            const val = Number(s.admin_verified_value ?? s.self_reported_value);
            const verified = s.status === "verified";
            return (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <ProfileAvatar
                  username={p?.username}
                  name={p?.display_name ?? p?.username ?? "?"}
                  avatarPath={p?.avatar_url}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-semibold">@{p?.username ?? "user"}</span>
                    <span className="text-muted-foreground">
                      {verified ? " verified " : " submitted "}
                    </span>
                    <span className="mono-stat font-semibold">
                      {formatValue(val, unitType, unitLabel)}
                    </span>
                    {!verified && (
                      <span className="ml-1.5 rounded-full bg-koth-pr-bg px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-pr-text">
                        pending
                      </span>
                    )}
                    {verified && (
                      <span className="ml-1.5 rounded-full bg-koth-red px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-white">
                        on board
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{relTime(s.submitted_at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
