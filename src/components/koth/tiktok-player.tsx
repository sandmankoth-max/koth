import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { Heart, MessageCircle, Share2, X, Play, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { getVideoSignedUrl, formatValue } from "@/lib/koth-utils";
import { cn } from "@/lib/utils";
import { CommentDrawer } from "@/components/koth/comment-drawer";
import { VideoScrubber } from "@/components/koth/video-scrubber";
import { deleteOwnSubmission } from "@/lib/submissions.functions";

export type PlayerItem = {
  id: string; // submission id
  video_path: string;
  caption?: string | null;
  value?: number | null;
  unit_type?: string;
  unit_label?: string;
  challenge_title?: string | null;
  user: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
  };
};

type Props = {
  items: PlayerItem[];
  startIndex?: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * Shared full-screen TikTok-style vertical video player.
 * - Tap video to pause/play
 * - Double-tap to like
 * - Up/down arrows or swipe to switch videos
 * - Action rail: avatar (tap → profile), like, comment, share
 */
export function TikTokPlayer({ items, startIndex = 0, open, onOpenChange }: Props) {
  const [index, setIndex] = useState(startIndex);
  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  if (!items.length) return null;
  const safeIndex = Math.min(Math.max(0, index), items.length - 1);
  const current = items[safeIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 border-0 bg-black p-0 sm:rounded-3xl [&>button]:hidden">
        <DialogTitle className="sr-only">@{current.user.username}</DialogTitle>
        <PlayerStage
          item={current}
          canPrev={safeIndex > 0}
          canNext={safeIndex < items.length - 1}
          onPrev={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PlayerStage({
  item,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
}: {
  item: PlayerItem;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const deleteSubmission = useServerFn(deleteOwnSubmission);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const lastTap = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const isOwner = !!user && user.id === item.user.id;

  async function handleDelete() {
    if (!isOwner || deleting) return;
    setDeleting(true);
    try {
      await deleteSubmission({ data: { submissionId: item.id } });
      toast.success("Video deleted");
      qc.invalidateQueries({ queryKey: ["my-videos"] });
      qc.invalidateQueries({ queryKey: ["my-entry"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["top3"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["user-videos"] });
      setDeleteOpen(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let active = true;
    setUrl(null);
    getVideoSignedUrl(item.video_path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [item.video_path]);

  // like state
  const likeQ = useQuery({
    queryKey: ["video-likes", item.id],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase
          .from("video_likes")
          .select("*", { count: "exact", head: true })
          .eq("submission_id", item.id),
        user
          ? supabase
              .from("video_likes")
              .select("submission_id")
              .eq("submission_id", item.id)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });

  const commentCountQ = useQuery({
    queryKey: ["video-comment-count", item.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("video_comments")
        .select("*", { count: "exact", head: true })
        .eq("submission_id", item.id);
      return count ?? 0;
    },
  });

  async function toggleLike() {
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
    const liked = likeQ.data?.liked;
    qc.setQueryData(["video-likes", item.id], (old: any) => ({
      count: (old?.count ?? 0) + (liked ? -1 : 1),
      liked: !liked,
    }));
    if (liked) {
      await supabase
        .from("video_likes")
        .delete()
        .eq("submission_id", item.id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("video_likes")
        .insert({ submission_id: item.id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["video-likes", item.id] });
  }

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // double-tap → like
      if (!likeQ.data?.liked) toggleLike();
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (Math.abs(dy) < 60) return;
    if (dy < 0 && canNext) onNext();
    else if (dy > 0 && canPrev) onPrev();
  }

  return (
    <div
      className="relative h-[80vh] w-full overflow-hidden bg-black sm:rounded-3xl"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="tap-44 absolute right-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Video */}
      <button
        type="button"
        onClick={handleTap}
        className="absolute inset-0 z-0 flex items-center justify-center"
        aria-label="Tap to pause or play"
      >
        {url ? (
          <video
            ref={videoRef}
            src={url}
            autoPlay
            loop
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-neutral-900" />
        )}
        {paused && (
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur">
              <Play className="h-8 w-8 text-white" />
            </span>
          </span>
        )}
        {burst && (
          <Heart
            className="pointer-events-none absolute z-20 h-32 w-32 animate-ping text-koth-red"
            fill="currentColor"
          />
        )}
      </button>

      {/* Scrubber */}
      <div className="absolute inset-x-3 bottom-[88px] z-20">
        <VideoScrubber videoRef={videoRef} />
      </div>

      {/* Bottom-left info */}
      <div className="absolute bottom-4 left-4 right-20 z-20 text-white">
        <Link
          to="/u/$username"
          params={{ username: item.user.username }}
          onClick={(e) => e.stopPropagation()}
          className="text-base font-bold"
        >
          @{item.user.username}
        </Link>
        {item.challenge_title && (
          <p className="mt-1 text-xs text-white/80">
            <span className="rounded-full bg-koth-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {item.challenge_title}
            </span>
            {item.value != null && item.unit_type && (
              <span className="ml-2 mono-stat font-bold">
                {formatValue(item.value, item.unit_type, item.unit_label ?? "")}
              </span>
            )}
          </p>
        )}
        {item.caption && <p className="mt-2 text-sm text-white/90">{item.caption}</p>}
      </div>

      {/* Right action rail */}
      <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-5 text-white">
        <Link
          to="/u/$username"
          params={{ username: item.user.username }}
          onClick={(e) => e.stopPropagation()}
          className="tap-44 relative z-30 inline-flex items-center justify-center rounded-full ring-2 ring-koth-red"
          aria-label={`Open @${item.user.username}'s profile`}
        >
          <Avatar
            name={item.user.display_name ?? item.user.username}
            avatarPath={item.user.avatar_url ?? null}
            size={44}
          />
        </Link>

        <RailButton
          onClick={toggleLike}
          icon={
            <Heart
              className={cn("h-7 w-7", likeQ.data?.liked && "fill-koth-red text-koth-red")}
            />
          }
          count={likeQ.data?.count ?? 0}
          label="like"
        />
        <RailButton
          onClick={() => setCommentsOpen(true)}
          icon={<MessageCircle className="h-7 w-7" />}
          count={commentCountQ.data ?? 0}
          label="comments"
        />
        <RailButton
          onClick={() => toast.message("Sharing coming soon")}
          icon={<Share2 className="h-7 w-7" />}
          count={0}
          label="share"
        />
        {isOwner && (
          <RailButton
            onClick={() => setDeleteOpen(true)}
            icon={<Trash2 className="h-6 w-6" />}
            count={0}
            label="delete"
          />
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Your entry will be removed from the leaderboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CommentDrawer
        kind="video"
        targetId={item.id}
        ownerId={item.user.id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />


      {/* Up/down navigation */}
      {canPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="tap-44 absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur"
          aria-label="Previous video"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      )}
      {canNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="tap-44 absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur"
          aria-label="Next video"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function RailButton({
  onClick,
  icon,
  count,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="tap-44 flex flex-col items-center gap-0.5"
      aria-label={label}
    >
      {icon}
      <span className="mono-stat text-[11px] font-bold leading-none">
        {formatCount(count)}
      </span>
    </button>
  );
}

function formatCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
