import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar } from "@/components/koth/avatar";
import { formatDistanceToNowStrict } from "date-fns";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type Kind = "video" | "challenge";

type Props = {
  kind: Kind;
  targetId: string; // submission id (video) or challenge id (challenge)
  /** Only needed for video kind — enables owner-delete-any-comment. */
  ownerId?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type CommentRow = {
  id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  reply_count: number;
  like_count: number;
  created_at: string;
  tagged_user_ids: string[] | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function tableName(kind: Kind) {
  return kind === "video" ? "video_comments" : "challenge_comments";
}
function targetColumn(kind: Kind) {
  return kind === "video" ? "submission_id" : "challenge_id";
}

function rel(d: string) {
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true })
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d");
}

export function CommentDrawer({ kind, targetId, ownerId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const table = tableName(kind);
  const col = targetColumn(kind);

  const commentsQ = useQuery({
    queryKey: [`${kind}-comments`, targetId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.from(table) as any)
        .select(
          "id, author_id, body, parent_id, reply_count, like_count, created_at, tagged_user_ids",
        )
        .eq(col, targetId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
      let profilesById = new Map<string, any>();
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", authorIds);
        profilesById = new Map((profs ?? []).map((p) => [p.id, p]));
      }
      return rows.map((r) => ({ ...r, profiles: profilesById.get(r.author_id) ?? null })) as CommentRow[];
    },
  });

  const rows = commentsQ.data ?? [];
  const tops = rows.filter((r) => r.parent_id === null);
  const repliesByParent = useMemo(() => {
    const m = new Map<string, CommentRow[]>();
    for (const r of rows) {
      if (r.parent_id) {
        const list = m.get(r.parent_id) ?? [];
        list.push(r);
        m.set(r.parent_id, list);
      }
    }
    return m;
  }, [rows]);

  // Realtime: refetch on insert/delete to this target.
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`comments-${kind}-${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${col}=eq.${targetId}` },
        () => qc.invalidateQueries({ queryKey: [`${kind}-comments`, targetId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, kind, targetId, col, table, qc]);

  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function confirmDelete() {
    const id = pendingDelete;
    if (!id) return;
    setPendingDelete(null);
    const { error } = await (supabase.from(table) as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: [`${kind}-comments`, targetId] });
    if (kind === "video") {
      qc.invalidateQueries({ queryKey: ["video-comment-count", targetId] });
    }
  }

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="text-base">
            {tops.length} {tops.length === 1 ? "comment" : "comments"}
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {commentsQ.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tops.length === 0 ? (
            <div className="py-10 text-center">
              <MessageCircle className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="mt-2 text-sm text-muted-foreground">
                No comments yet. Set the tone.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tops.map((c) => (
                <CommentItem
                  key={c.id}
                  kind={kind}
                  c={c}
                  replies={repliesByParent.get(c.id) ?? []}
                  ownerId={ownerId}
                  viewerId={user?.id}
                  onReply={() => setReplyTo(c)}
                  onDelete={setPendingDelete}
                />
              ))}
            </ul>
          )}
        </div>

        <Composer
          kind={kind}
          targetId={targetId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onPosted={() => {
            setReplyTo(null);
            qc.invalidateQueries({ queryKey: [`${kind}-comments`, targetId] });
            if (kind === "video") {
              qc.invalidateQueries({ queryKey: ["video-comment-count", targetId] });
            }
          }}
        />
      </DrawerContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}

function CommentItem({
  kind,
  c,
  replies,
  ownerId,
  viewerId,
  onReply,
  onDelete,
}: {
  kind: Kind;
  c: CommentRow;
  replies: CommentRow[];
  ownerId?: string | null;
  viewerId?: string;
  onReply: () => void;
  onDelete: (id: string) => void;
}) {
  const canDelete =
    !!viewerId && (c.author_id === viewerId || (kind === "video" && ownerId === viewerId));
  return (
    <li>
      <CommentRowView c={c} viewerId={viewerId} canDelete={canDelete} kind={kind} onReply={onReply} onDelete={onDelete} />
      {replies.length > 0 && (
        <ul className="ml-10 mt-2 space-y-2 border-l border-border pl-3">
          {replies.map((r) => {
            const canDelR =
              !!viewerId && (r.author_id === viewerId || (kind === "video" && ownerId === viewerId));
            return (
              <li key={r.id}>
                <CommentRowView
                  c={r}
                  viewerId={viewerId}
                  canDelete={canDelR}
                  kind={kind}
                  isReply
                  onReply={onReply}
                  onDelete={onDelete}
                />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function CommentRowView({
  c,
  kind,
  viewerId,
  canDelete,
  isReply,
  onReply,
  onDelete,
}: {
  c: CommentRow;
  kind: Kind;
  viewerId?: string;
  canDelete: boolean;
  isReply?: boolean;
  onReply: () => void;
  onDelete: (id: string) => void;
}) {
  const qc = useQueryClient();
  const username = c.profiles?.username ?? "user";

  const likeQ = useQuery({
    queryKey: ["comment-like", kind, c.id, viewerId],
    enabled: !!viewerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("kind", kind)
        .eq("comment_id", c.id)
        .eq("user_id", viewerId!)
        .maybeSingle();
      return !!data;
    },
  });
  const liked = likeQ.data;
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
  const count = optimisticCount ?? c.like_count;

  async function toggleLike() {
    if (!viewerId) {
      toast.error("Sign in to like");
      return;
    }
    const next = !liked;
    setOptimisticCount(count + (next ? 1 : -1));
    qc.setQueryData(["comment-like", kind, c.id, viewerId], next);
    if (next) {
      const { error } = await supabase
        .from("comment_likes")
        .insert({ comment_id: c.id, user_id: viewerId, kind });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", c.id)
        .eq("user_id", viewerId)
        .eq("kind", kind);
      if (error) toast.error(error.message);
    }
  }

  return (
    <div className="flex gap-2.5">
      <Link
        to="/u/$username"
        params={{ username }}
        className="tap-44 shrink-0 self-start"
        aria-label={`@${username}`}
      >
        <Avatar
          name={c.profiles?.display_name ?? username}
          avatarPath={c.profiles?.avatar_url}
          size={isReply ? 28 : 34}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <Link
            to="/u/$username"
            params={{ username }}
            className="font-semibold text-foreground"
          >
            @{username}
          </Link>{" "}
          <span className="text-foreground">{renderBodyWithMentions(c.body)}</span>
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{rel(c.created_at)}</span>
          <button onClick={onReply} className="font-semibold hover:text-foreground">
            Reply
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(c.id)}
              className="inline-flex items-center gap-1 font-semibold text-koth-red"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </div>
      <button
        onClick={toggleLike}
        className="tap-44 flex shrink-0 flex-col items-center self-start"
        aria-label="Like comment"
      >
        <Heart
          className={cn("h-4 w-4", liked ? "fill-koth-red text-koth-red" : "text-muted-foreground")}
        />
        {count > 0 && (
          <span className="mono-stat text-[10px] font-bold text-muted-foreground">{count}</span>
        )}
      </button>
    </div>
  );
}

function renderBodyWithMentions(body: string) {
  const parts = body.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@") && part.length > 1) {
      const uname = part.slice(1).toLowerCase();
      return (
        <Link key={i} to="/u/$username" params={{ username: uname }} className="font-semibold text-koth-red">
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function Composer({
  kind,
  targetId,
  replyTo,
  onCancelReply,
  onPosted,
}: {
  kind: Kind;
  targetId: string;
  replyTo: CommentRow | null;
  onCancelReply: () => void;
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const [taggedIds, setTaggedIds] = useState<Map<string, string>>(new Map()); // username → uuid

  useEffect(() => {
    if (replyTo) {
      const uname = replyTo.profiles?.username;
      if (uname && !body.startsWith(`@${uname}`)) {
        setBody(`@${uname} `);
        setTaggedIds((m) => new Map(m).set(uname, replyTo.author_id));
      }
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo?.id]);

  function handleChange(v: string) {
    setBody(v);
    const m = /@([a-zA-Z0-9_]{1,30})$/.exec(v);
    setMentionQ(m ? m[1].toLowerCase() : null);
  }

  const suggestionsQ = useQuery({
    queryKey: ["mention-search", mentionQ],
    enabled: !!mentionQ && mentionQ.length >= 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `${mentionQ}%`)
        .limit(6);
      return data ?? [];
    },
  });

  function pickMention(p: { id: string; username: string }) {
    const replaced = body.replace(/@[a-zA-Z0-9_]*$/, `@${p.username} `);
    setBody(replaced);
    setMentionQ(null);
    setTaggedIds((m) => new Map(m).set(p.username, p.id));
    inputRef.current?.focus();
  }

  async function send() {
    const text = body.trim();
    if (!text || !user) return;
    setPosting(true);
    try {
      // Re-extract @mentions present in final body and intersect with the
      // map we built while typing.
      const usernamesInBody = Array.from(text.matchAll(/@([a-zA-Z0-9_]+)/g)).map((m) => m[1].toLowerCase());
      const tagged_user_ids = Array.from(
        new Set(
          usernamesInBody
            .map((u) => taggedIds.get(u))
            .filter((v): v is string => !!v),
        ),
      );

      const row: any = {
        author_id: user.id,
        body: text,
        parent_id: replyTo?.id ?? null,
        tagged_user_ids,
      };
      if (kind === "video") row.submission_id = targetId;
      else row.challenge_id = targetId;

      const { error } = await (supabase.from(tableName(kind)) as any).insert(row);
      if (error) throw error;
      setBody("");
      setTaggedIds(new Map());
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="relative border-t border-border bg-background p-3">
      {mentionQ && suggestionsQ.data && suggestionsQ.data.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 max-h-56 overflow-y-auto rounded-2xl border border-border bg-card shadow-lg">
          {suggestionsQ.data.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickMention(p)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
            >
              <Avatar name={p.display_name ?? p.username} avatarPath={p.avatar_url} size={28} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">@{p.username}</p>
                {p.display_name && (
                  <p className="truncate text-xs text-muted-foreground">{p.display_name}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-xs">
          <span className="text-muted-foreground">
            Replying to <span className="font-semibold text-foreground">@{replyTo.profiles?.username}</span>
          </span>
          <button onClick={onCancelReply} className="ml-auto font-semibold text-koth-red">
            Cancel
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => handleChange(e.target.value)}
          rows={1}
          placeholder="Add a comment… use @ to tag"
          maxLength={500}
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-koth-red"
        />
        <button
          onClick={send}
          disabled={posting || !body.trim()}
          className="tap-44 inline-flex h-11 w-11 items-center justify-center rounded-full bg-koth-red text-koth-white disabled:opacity-50"
          aria-label="Post"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
