import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/koth/avatar";
import { CommentDrawer } from "@/components/koth/comment-drawer";

type Props = {
  challengeId: string;
};

function rel(d: string) {
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true })
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d");
}

/**
 * Home-page live trash-talk preview tied to the active challenge.
 * Shows the 3 most recent messages and opens the full CommentDrawer on tap.
 */
export function ChallengeChat({ challengeId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const recentQ = useQuery({
    queryKey: ["challenge-chat-preview", challengeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_comments")
        .select(
          "id, body, created_at, author_id, profiles!inner(username, display_name, avatar_url)",
        )
        .eq("challenge_id", challengeId)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`challenge-chat-${challengeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "challenge_comments",
          filter: `challenge_id=eq.${challengeId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["challenge-chat-preview", challengeId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [challengeId, qc]);

  const recent = recentQ.data ?? [];

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-koth-red" aria-hidden />
            <p className="label-broadcast text-muted-foreground">Trash talk</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="label-broadcast text-koth-red"
          >
            Open chat →
          </button>
        </div>

        {recent.length === 0 ? (
          <button
            onClick={() => setOpen(true)}
            className="tap-44 w-full rounded-2xl bg-muted/40 px-3 py-3 text-left text-sm text-muted-foreground"
          >
            Be the first to talk smack…
          </button>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((m: any) => (
              <li key={m.id} className="flex items-start gap-2.5">
                <Avatar
                  name={m.profiles?.display_name ?? m.profiles?.username ?? "?"}
                  avatarPath={m.profiles?.avatar_url}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold text-foreground">@{m.profiles?.username}</span>{" "}
                    <span className="text-foreground">{m.body}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{rel(m.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommentDrawer
        kind="challenge"
        targetId={challengeId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
