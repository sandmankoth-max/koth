import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
import { Heart, MessageCircle, Send, Play, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { getVideoSignedUrl, formatValue } from "@/lib/koth-utils";
import { AdminColorBadge } from "@/components/koth/admin-submissions";
import { cn } from "@/lib/utils";
import { CommentDrawer } from "@/components/koth/comment-drawer";
import { VideoScrubber } from "@/components/koth/video-scrubber";
import { deleteOwnSubmissionApi } from "@/lib/submissions-api";

export type PlayerItem = {
  id: string;
  video_path: string;
  caption?: string | null;
  value?: number | null;
  unit_type?: string;
  unit_label?: string;
  challenge_title?: string | null;
  on_leaderboard?: boolean;
  admin_color?: string | null;
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
  /** Hide the floating back button (e.g. when used as an embedded feed). */
  hideBack?: boolean;
  /** Optional control rendered inside the player chrome, above the video layer. */
  topLeftAction?: React.ReactNode;
};

/**
 * Full-screen TikTok-style vertical video player.
 * Renders all items in a snap-scroll list (same UX as the friends feed),
 * with IntersectionObserver driving play / load per slide.
 */
export function TikTokPlayer({
  items,
  startIndex = 0,
  open,
  onOpenChange,
  hideBack = false,
  topLeftAction,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  // Jump to startIndex when the player opens.
  useEffect(() => {
    if (!open) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const el = scroller.children?.[startIndex] as HTMLElement | undefined;
    // Wait a tick so the dialog has mounted.
    const id = window.setTimeout(() => {
      el?.scrollIntoView({ block: "start" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, startIndex]);

  if (!items.length || !open) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 bg-black"
      style={{
        top: "calc(3.5rem + env(safe-area-inset-top))",
        bottom: "calc(4rem + env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Videos"
    >
      {!hideBack && (
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Back"
          className="tap-44 absolute left-3 top-3 z-50 text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      )}
      {topLeftAction && <div className="absolute left-3 top-3 z-50">{topLeftAction}</div>}

      <div
        ref={scrollerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain bg-black"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {items.map((it) => (
          <PlayerSlide key={it.id} item={it} scrollRoot={scrollerRef} onClose={() => onOpenChange(false)} />
        ))}
      </div>
    </div>
  );
}

function PlayerSlide({
  item,
  scrollRoot,
  onClose,
}: {
  item: PlayerItem;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const lastTap = useRef(0);
  const isOwner = !!user && user.id === item.user.id;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setVisible(e.intersectionRatio > 0.6)),
      { root: scrollRoot.current, threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible || url) return;
    let active = true;
    getVideoSignedUrl(item.video_path).then((u) => active && setUrl(u));
    return () => { active = false; };
  }, [visible, url, item.video_path]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible && !paused) v.play().catch(() => {});
    else v.pause();
  }, [visible, paused, url]);

  const likeQ = useQuery({
    queryKey: ["video-likes", item.id],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("video_likes").select("*", { count: "exact", head: true }).eq("submission_id", item.id),
        user
          ? supabase.from("video_likes").select("submission_id")
              .eq("submission_id", item.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });

  const commentCountQ = useQuery({
    queryKey: ["video-comment-count", item.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("video_comments").select("*", { count: "exact", head: true }).eq("submission_id", item.id);
      return count ?? 0;
    },
  });

  async function toggleLike() {
    if (!user) { toast.error("Sign in to like"); return; }
    const liked = likeQ.data?.liked;
    qc.setQueryData(["video-likes", item.id], (old: any) => ({
      count: (old?.count ?? 0) + (liked ? -1 : 1),
      liked: !liked,
    }));
    if (liked) {
      await supabase.from("video_likes").delete().eq("submission_id", item.id).eq("user_id", user.id);
    } else {
      await supabase.from("video_likes").insert({ submission_id: item.id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["video-likes", item.id] });
  }

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!likeQ.data?.liked) toggleLike();
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    setPaused((p) => !p);
  }

  async function handleDelete() {
    if (!isOwner || deleting) return;
    setDeleting(true);
    try {
      await deleteOwnSubmissionApi(item.id);
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

  return (
    <div
      ref={containerRef}
      className="relative w-full snap-start snap-always bg-black"
      style={{ height: "100%", minHeight: "100%", scrollSnapStop: "always" }}
    >
      <button
        type="button"
        onClick={handleTap}
        className="absolute inset-0 z-0 flex items-center justify-center"
        aria-label="Tap to pause or play"
      >
        {url ? (
          <video ref={videoRef} src={url} loop playsInline className="h-full w-full object-cover" />
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
          <Heart className="pointer-events-none absolute z-20 h-32 w-32 animate-ping text-koth-red" fill="currentColor" />
        )}
      </button>

      {/* Scrubber pinned to bottom */}
      <div className="absolute inset-x-3 bottom-1 z-30">
        <VideoScrubber videoRef={videoRef} />
      </div>

      {/* Bottom-left info */}
      <div className="absolute bottom-7 left-4 right-20 z-20 text-white">
        <Link
          to="/u/$username"
          params={{ username: item.user.username }}
          onClick={(e) => e.stopPropagation()}
          className="block max-w-full truncate text-base font-bold"
        >
          @{item.user.username}
        </Link>
        {item.challenge_title && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="max-w-[60vw] truncate rounded-full bg-koth-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {item.challenge_title}
            </span>
            {item.value != null && item.unit_type && (
              <span className="mono-stat text-xs font-bold">
                {formatValue(item.value, item.unit_type, item.unit_label ?? "")}
              </span>
            )}
            {isStaff && item.admin_color && <AdminColorBadge color={item.admin_color} />}
          </div>
        )}
        {item.caption && <p className="mt-2 line-clamp-2 text-sm text-white/90">{item.caption}</p>}
      </div>

      {/* Right rail — Instagram-style: slim 1.5 stroke, larger icons, subtle drop shadow */}
      <div className="absolute right-2.5 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-6 text-white">
        <Link
          to="/u/$username"
          params={{ username: item.user.username }}
          onClick={(e) => e.stopPropagation()}
          className="tap-44 relative z-30 inline-flex items-center justify-center rounded-full ring-2 ring-white/90"
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
              strokeWidth={1.5}
              className={cn(
                "h-9 w-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] transition-transform",
                likeQ.data?.liked && "scale-110 fill-koth-red text-koth-red",
              )}
            />
          }
          count={likeQ.data?.count ?? 0}
          label="like"
        />
        <RailButton
          onClick={() => setCommentsOpen(true)}
          icon={
            <MessageCircle
              strokeWidth={1.5}
              className="h-9 w-9 -scale-x-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
            />
          }
          count={commentCountQ.data ?? 0}
          label="comments"
        />
        <RailButton
          onClick={() => toast.message("Sharing coming soon")}
          icon={
            <Send
              strokeWidth={1.5}
              className="h-9 w-9 -rotate-12 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
            />
          }
          count={0}
          label="share"
        />
        {isOwner && (
          <RailButton
            onClick={() => setDeleteOpen(true)}
            icon={<Trash2 strokeWidth={1.5} className="h-8 w-8 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />}
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
              {item.on_leaderboard
                ? "This cannot be undone. Your entry will be removed from the leaderboard."
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
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
    </div>
  );
}

function RailButton({
  onClick, icon, count, label,
}: { onClick: () => void; icon: React.ReactNode; count: number; label: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="tap-44 flex flex-col items-center gap-0.5 transition-transform duration-150 ease-out active:scale-90 will-change-transform"
      aria-label={label}
    >
      {icon}
      {count > 0 && (
        <span className="text-[11px] font-semibold leading-none tracking-tight tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
          {formatCount(count)}
        </span>
      )}
    </button>
  );
}



function formatCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
