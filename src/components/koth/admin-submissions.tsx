/**
 * Admin Submissions gallery + scrolling grading feed.
 * - Pick a challenge, filter by Pending / Verified / Suspended.
 * - Grid of public submissions (friends-only excluded) with username caption.
 * - Click a thumb → vertical snap-scroll grading feed (same UX as friends feed).
 *   In-feed actions: enter adjusted value + Verify, Suspend (in-app dialog), Ban user.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoThumb } from "@/components/koth/video-thumb";
import { getVideoSignedUrl, formatValue } from "@/lib/koth-utils";
import { X, CheckCircle2, Ban, ShieldX, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createAdminAccount } from "@/lib/admin-accounts.functions";

export const ADMIN_COLOR_MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  red:    { label: "Red",    dot: "bg-red-500",    bg: "bg-red-500/20",    text: "text-red-300" },
  blue:   { label: "Blue",   dot: "bg-blue-500",   bg: "bg-blue-500/20",   text: "text-blue-300" },
  green:  { label: "Green",  dot: "bg-emerald-500",bg: "bg-emerald-500/20",text: "text-emerald-300" },
  yellow: { label: "Yellow", dot: "bg-yellow-400", bg: "bg-yellow-400/20", text: "text-yellow-200" },
  purple: { label: "Purple", dot: "bg-purple-500", bg: "bg-purple-500/20", text: "text-purple-300" },
};

export function AdminColorBadge({ color, className = "" }: { color?: string | null; className?: string }) {
  if (!color || !ADMIN_COLOR_MAP[color]) return null;
  const c = ADMIN_COLOR_MAP[color];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

type Status = "pending_review" | "verified" | "disqualified";

const STATUS_LABEL: Record<Status, string> = {
  pending_review: "Pending",
  verified: "Verified",
  disqualified: "Suspended",
};

export function AdminSubmissions() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengeId, setChallengeId] = useState<string>("");
  const [status, setStatus] = useState<Status>("pending_review");
  const [subs, setSubs] = useState<any[]>([]);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("challenges")
      .select("id, title, status, unit_type, unit_label")
      .order("starts_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setChallenges(data ?? []);
        const active = (data ?? []).find((c) => c.status === "active");
        if (active) setChallengeId(active.id);
        else if (data?.[0]) setChallengeId(data[0].id);
      });
  }, []);

  async function refetch() {
    if (!challengeId) return;
    const { data } = await supabase
      .from("submissions")
      .select(
        "id, user_id, video_path, self_reported_value, admin_verified_value, submitted_at, status, visibility, admin_color, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
      )
      .eq("challenge_id", challengeId)
      .eq("visibility", "public")
      .eq("status", status)
      .order("submitted_at", { ascending: false });
    setSubs(data ?? []);
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, status]);

  const challenge = useMemo(
    () => challenges.find((c) => c.id === challengeId),
    [challenges, challengeId],
  );

  return (
    <div className="mt-4 space-y-3">
      <Select value={challengeId} onValueChange={setChallengeId}>
        <SelectTrigger><SelectValue placeholder="Pick a challenge" /></SelectTrigger>
        <SelectContent>
          {challenges.map((c) => (
            <SelectItem key={c.id} value={c.id}>[{c.status}] {c.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filter pills */}
      <div className="grid grid-cols-3 gap-1.5 rounded-full border border-border bg-card p-1">
        {(["pending_review", "verified", "disqualified"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`tap-44 rounded-full py-1.5 text-xs font-bold transition ${
              status === s ? "bg-koth-red text-koth-white" : "text-muted-foreground"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {subs.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No {STATUS_LABEL[status].toLowerCase()} submissions.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-[2px]">
          {subs.map((s, i) => (
            <div key={s.id} className="space-y-1">
              <VideoThumb
                videoPath={s.video_path}
                className="rounded-none"
                onClick={() => setPlayerIndex(i)}
              />
              <p className="truncate px-1 text-center text-[10px] font-semibold text-foreground">
                @{s.profiles?.username}
              </p>
            </div>
          ))}
        </div>
      )}

      {playerIndex !== null && challenge && (
        <AdminGradingFeed
          challenge={challenge}
          subs={subs}
          startIndex={playerIndex}
          onClose={() => setPlayerIndex(null)}
          onChanged={() => { refetch(); }}
        />
      )}
    </div>
  );
}

function AdminGradingFeed({
  challenge, subs, startIndex, onClose, onChanged,
}: {
  challenge: any;
  subs: any[];
  startIndex: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = scrollerRef.current?.children?.[startIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "start" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [startIndex]);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="fixed left-1/2 top-1/2 h-[100dvh] w-screen max-w-md -translate-x-1/2 -translate-y-1/2 gap-0 border-0 bg-black p-0 sm:rounded-none [&>button]:hidden">
        <DialogTitle className="sr-only">Admin grading — {challenge.title}</DialogTitle>
        <button
          onClick={onClose}
          aria-label="Close"
          className="tap-44 absolute right-3 top-3 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          <X className="h-5 w-5" />
        </button>
        <div
          ref={scrollerRef}
          className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain bg-black"
          style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          {subs.map((s) => (
            <AdminGradeSlide
              key={s.id}
              s={s}
              challenge={challenge}
              scrollRoot={scrollerRef}
              onChanged={onChanged}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminGradeSlide({
  s, challenge, scrollRoot, onChanged,
}: {
  s: any;
  challenge: any;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onChanged: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState<string>(
    s.admin_verified_value?.toString() ?? s.self_reported_value?.toString() ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");

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
    getVideoSignedUrl(s.video_path).then((u) => active && setUrl(u));
    return () => { active = false; };
  }, [visible, url, s.video_path]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [visible, url]);

  async function verify() {
    const n = value === "" ? null : Number(value);
    if (n !== null && Number.isNaN(n)) { toast.error("Enter a valid number"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("submissions")
      .update({ status: "verified", is_active_entry: true, admin_verified_value: n })
      .eq("id", s.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Verified"); onChanged(); }
  }

  async function confirmSuspend() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_disqualify_submission" as any, {
      p_submission_id: s.id,
      p_reason: reason.trim() || null,
    });
    setBusy(false);
    setSuspendOpen(false);
    setReason("");
    if (error) toast.error(error.message);
    else { toast.success("Suspended"); onChanged(); }
  }

  async function confirmBan() {
    if (!reason.trim()) { toast.error("Enter a reason"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_ban_user" as any, {
      p_user_id: s.user_id,
      p_reason: reason.trim(),
    });
    setBusy(false);
    setBanOpen(false);
    setReason("");
    if (error) toast.error(error.message);
    else { toast.success(`Banned @${s.profiles?.username}`); onChanged(); }
  }

  async function confirmDelete() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_submission" as any, { p_submission_id: s.id });
    setBusy(false);
    setDeleteOpen(false);
    if (error) toast.error(error.message);
    else { toast.success("Video deleted"); onChanged(); }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full snap-start snap-always bg-black"
      style={{ height: "100dvh", minHeight: "100dvh", scrollSnapStop: "always" }}
    >
      {url ? (
        <video ref={videoRef} src={url} loop playsInline className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-neutral-900" />
      )}

      {/* Top: status + user */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/75 to-transparent px-4 pt-12 pb-4 text-white">
        <Avatar name={s.profiles?.display_name ?? s.profiles?.username} avatarPath={s.profiles?.avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">@{s.profiles?.username}</p>
          <p className="text-[11px] text-white/70">
            Reported{" "}
            <span className="mono-stat font-bold text-white">
              {formatValue(Number(s.self_reported_value ?? 0), challenge.unit_type, challenge.unit_label)}
            </span>
          </p>
        </div>
        <span className={`pill ${
          s.status === "verified" ? "bg-koth-pr-bg text-koth-pr-text" :
          s.status === "disqualified" ? "bg-koth-red text-white" :
          "bg-white/20 text-white"
        }`}>
          {s.status === "pending_review" ? "Pending" : s.status === "verified" ? "Verified" : "Suspended"}
        </span>
      </div>

      {/* Bottom: actions */}
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pb-7 pt-6">
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 p-2 backdrop-blur">
          <Input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Adjusted value"
            className="h-10 flex-1 rounded-full border-0 bg-transparent px-3 text-white placeholder:text-white/50 focus-visible:ring-0"
          />
          <Button
            onClick={verify}
            disabled={busy}
            className="h-10 rounded-full bg-koth-pr-bg px-4 text-koth-pr-text hover:bg-koth-pr-bg/90"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Verify
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => { setReason(""); setSuspendOpen(true); }}
            disabled={busy}
            className="tap-44 flex items-center justify-center gap-1.5 rounded-full border border-koth-red bg-koth-red/15 py-2.5 text-xs font-bold text-koth-red backdrop-blur hover:bg-koth-red hover:text-white"
          >
            <ShieldX className="h-4 w-4" /> Suspend
          </button>
          <button
            onClick={() => { setReason("Inappropriate content"); setBanOpen(true); }}
            disabled={busy}
            className="tap-44 flex items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/5 py-2.5 text-xs font-bold text-white backdrop-blur hover:bg-koth-red hover:border-koth-red"
          >
            <Ban className="h-4 w-4" /> Ban
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
            className="tap-44 flex items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/5 py-2.5 text-xs font-bold text-white backdrop-blur hover:bg-koth-red hover:border-koth-red"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <ReasonDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspend this submission?"
        description="The reason you enter will be sent to the user in their notification center."
        confirmLabel="Suspend"
        reason={reason}
        setReason={setReason}
        onConfirm={confirmSuspend}
        busy={busy}
      />
      <ReasonDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        title={`Ban @${s.profiles?.username}?`}
        description="This disqualifies their entries and permanently blocks the username from being reused."
        confirmLabel="Ban user"
        reason={reason}
        setReason={setReason}
        onConfirm={confirmBan}
        busy={busy}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the submission, its likes and comments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={busy}
              className="bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              {busy ? "…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ReasonDialog({
  open, onOpenChange, title, description, confirmLabel, reason, setReason, onConfirm, busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  reason: string;
  setReason: (r: string) => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (sent to user)"
          rows={3}
          className="resize-none rounded-xl"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={busy}
            className="bg-koth-red text-koth-white hover:bg-koth-red/90"
          >
            {busy ? "…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
