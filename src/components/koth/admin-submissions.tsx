/**
 * Admin Submissions gallery + scrolling grading feed.
 * - Pick a challenge, filter by Pending / Verified / Suspended.
 * - Grid of public submissions (friends-only excluded) with username caption.
 * - Click a thumb to enter a vertical TikTok-style grading scroller for that filter.
 *   In-feed actions: enter value + Verify, Suspend (with reason), Ban user.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoThumb } from "@/components/koth/video-thumb";
import { getVideoSignedUrl, formatValue } from "@/lib/koth-utils";
import { X } from "lucide-react";
import { toast } from "sonner";

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
        "id, user_id, video_path, self_reported_value, admin_verified_value, submitted_at, status, visibility, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
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
  const [index, setIndex] = useState(startIndex);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Scroll to the starting index on mount.
  useEffect(() => {
    const el = scrollerRef.current?.children?.[startIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="h-[100dvh] w-screen max-w-none gap-0 border-0 bg-black p-0 sm:rounded-none [&>button]:hidden">
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
          {subs.map((s, i) => (
            <AdminGradeSlide
              key={s.id}
              s={s}
              challenge={challenge}
              active={i === index}
              scrollRoot={scrollerRef}
              onVisible={() => setIndex(i)}
              onChanged={onChanged}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminGradeSlide({
  s, challenge, active, scrollRoot, onVisible, onChanged,
}: {
  s: any;
  challenge: any;
  active: boolean;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onVisible: () => void;
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        const vis = e.intersectionRatio > 0.6;
        setVisible(vis);
        if (vis) onVisible();
      }),
      { root: scrollRoot.current, threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, onVisible]);

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

  async function suspend() {
    const reason = window.prompt("Reason for suspending? (sent to user)", "") ?? "";
    if (reason === null) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_disqualify_submission" as any, {
      p_submission_id: s.id,
      p_reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Suspended"); onChanged(); }
  }

  async function ban() {
    const reason = window.prompt(
      `Ban @${s.profiles?.username}? Reason:`,
      "Inappropriate content",
    );
    if (!reason) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_ban_user" as any, {
      p_user_id: s.user_id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`Banned @${s.profiles?.username}`); onChanged(); }
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
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pt-12 pb-3 text-white">
        <Avatar name={s.profiles?.display_name ?? s.profiles?.username} avatarPath={s.profiles?.avatar_url} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">@{s.profiles?.username}</p>
          <p className="text-[11px] text-white/70">
            Reported: <span className="mono-stat font-bold">{formatValue(Number(s.self_reported_value ?? 0), challenge.unit_type, challenge.unit_label)}</span>
          </p>
        </div>
        <span className={`pill ${
          s.status === "verified" ? "bg-koth-pr-bg text-koth-pr-text" :
          s.status === "disqualified" ? "bg-koth-red text-white" :
          "bg-white/20 text-white"
        }`}>{s.status === "pending_review" ? "Pending" : s.status === "verified" ? "Verified" : "Suspended"}</span>
      </div>

      {/* Bottom: actions */}
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-6 pt-4">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Adjusted value"
            className="h-10 flex-1 rounded-full bg-white/10 text-white placeholder:text-white/50 border-white/20"
          />
          <Button
            onClick={verify}
            disabled={busy}
            className="h-10 rounded-full bg-koth-pr-bg text-koth-pr-text hover:bg-koth-pr-bg/90"
          >
            Verify
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={suspend}
            disabled={busy}
            variant="outline"
            className="h-10 flex-1 rounded-full border-koth-red bg-transparent text-koth-red hover:bg-koth-red hover:text-white"
          >
            Suspend
          </Button>
          <Button
            onClick={ban}
            disabled={busy}
            variant="outline"
            className="h-10 flex-1 rounded-full border-koth-red bg-transparent text-koth-red hover:bg-koth-red hover:text-white"
          >
            Ban user
          </Button>
        </div>
      </div>
    </div>
  );
}
