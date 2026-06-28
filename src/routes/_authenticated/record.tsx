import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cleanupPreviousSubmissionsApi } from "@/lib/submissions-api";
import { CameraRecorder, type CapturedVideo } from "@/components/koth/camera-recorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/record")({
  head: () => ({ meta: [{ title: "Record — KOTH" }] }),
  component: Record,
});

type Stage = "intro" | "camera" | "preview" | "report" | "visibility" | "confirm" | "uploading";
type Visibility = "public" | "friends_only";

const SEEN_VIS_KEY = "koth.seenVisibilityExplainer";

function Record() {
  const navigate = useNavigate();
  const deletePreviousSubmissions = useServerFn(deletePreviousSubmissionsForChallenge);
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("intro");
  const [captured, setCaptured] = useState<CapturedVideo | null>(null);
  const [reportedValue, setReportedValue] = useState("");
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [explainOpen, setExplainOpen] = useState<Visibility | null>(null);
  const [challenge, setChallenge] = useState<any>(null);
  const [suspension, setSuspension] = useState<{ until: string; reason: string | null } | null>(null);

  useEffect(() => {
    supabase
      .from("challenges")
      .select("*")
      .eq("status", "active")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setChallenge(data));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("suspended_until, suspension_reason")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.suspended_until && new Date(data.suspended_until).getTime() > Date.now()) {
          setSuspension({ until: data.suspended_until, reason: data.suspension_reason ?? null });
        } else {
          setSuspension(null);
        }
      });
  }, [user]);

  useEffect(() => {
    return () => {
      if (captured?.previewUrl) URL.revokeObjectURL(captured.previewUrl);
    };
  }, [captured]);

  const challengeEnded =
    !!challenge && new Date(challenge.ends_at).getTime() <= Date.now();

  if (!challenge || challengeEnded) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="label-broadcast text-muted-foreground">No active challenge</p>
        <p className="mt-2 text-sm text-muted-foreground">
          New challenge drops Monday at 10am.
        </p>
      </div>
    );
  }

  if (stage === "camera") {
    const cap = challenge.max_video_seconds ?? 300;
    return (
      <CameraRecorder
        maxSeconds={cap}
        onCancel={() => setStage("intro")}
        onCapture={(v) => {
          if (v.durationMs > cap * 1000 + 500) {
            toast.error(`Video exceeded the ${cap}s limit. Please re-record.`);
            URL.revokeObjectURL(v.previewUrl);
            return;
          }
          setCaptured(v);
          setStage("preview");
        }}
      />
    );
  }

  async function submit() {
    if (!user || !captured || !reportedValue) return;
    setStage("uploading");
    try {
      const ext = captured.mimeType.includes("mp4") ? "mp4" : "webm";
      const path = `${user.id}/${challenge.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("koth-videos")
        .upload(path, captured.blob, { contentType: captured.mimeType, upsert: false });
      if (upErr) throw upErr;

      const { data: submission, error: insErr } = await supabase
        .from("submissions")
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          video_path: path,
          self_reported_value: Math.round(Number(reportedValue) * 10) / 10,
          visibility: visibility ?? "public",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      if (!submission) throw new Error("Submission failed");
      await deletePreviousSubmissions({
        data: {
          challengeId: challenge.id,
          keepSubmissionId: submission.id,
          visibility: visibility ?? "public",
        },
      });

      toast.success("Submission locked in. Good luck.");
      navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setStage("confirm");
    }
  }

  return (
    <div className="space-y-5">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <p className="label-broadcast text-koth-white/60">Recording for</p>
        <h1 className="mt-1 text-xl font-bold">{challenge.title}</h1>
        <p className="mt-2 text-xs text-koth-white/70">
          Live capture only — no uploads from camera roll.
          {challenge.max_video_seconds ? ` Max ${challenge.max_video_seconds}s.` : ""}
        </p>
      </section>

      {stage === "intro" && (
        <div className="space-y-3">
          {challenge.safety_note && (
            <div className="rounded-2xl bg-koth-pr-bg p-4 text-sm text-koth-pr-text">
              <p className="label-broadcast mb-1">Safety</p>
              {challenge.safety_note}
            </div>
          )}
          <Button
            onClick={() => setStage("camera")}
            className="tap-44 h-14 w-full rounded-full bg-koth-red text-base font-bold text-koth-white hover:bg-koth-red/90"
          >
            <Video className="mr-2 h-5 w-5" aria-hidden />
            Open camera
          </Button>
        </div>
      )}

      {stage === "preview" && captured && (
        <div className="space-y-3">
          <video
            src={captured.previewUrl}
            controls
            playsInline
            className="aspect-[9/16] w-full rounded-3xl bg-black object-cover"
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                URL.revokeObjectURL(captured.previewUrl);
                setCaptured(null);
                setStage("camera");
              }}
              className="tap-44 h-12 rounded-full"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
              Retake
            </Button>
            <Button
              onClick={() => setStage("report")}
              className="tap-44 h-12 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              <Check className="mr-1.5 h-4 w-4" aria-hidden />
              Use this
            </Button>
          </div>
        </div>
      )}

      {stage === "report" && (
        <div className="space-y-4">
          <Label className="label-broadcast text-muted-foreground">Your {challenge.unit_label}</Label>
          <Input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={reportedValue}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (raw === "") { setReportedValue(""); return; }
              if (!/^\d*\.?\d*$/.test(raw)) return;
              const [intPart, decPart] = raw.split(".");
              if (intPart.length > 3) return;
              if (decPart !== undefined && decPart.length > 1) return;
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 1000) return;
              setReportedValue(raw);
            }}
            onBlur={() => {
              if (!reportedValue) return;
              const n = Number(reportedValue);
              if (!Number.isFinite(n)) return;
              const rounded = Math.round(n * 10) / 10;
              setReportedValue(rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1));
            }}
            autoFocus
            placeholder="0"
            className="mono-stat h-20 rounded-2xl text-center text-4xl font-bold"
          />
          <p className="text-center text-xs text-muted-foreground">
            {challenge.unit_label}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setStage("preview")}
              className="tap-44 h-12 rounded-full"
            >
              Back
            </Button>
            <Button
              onClick={() => setStage("visibility")}
              disabled={!reportedValue || !Number.isFinite(Number(reportedValue)) || Number(reportedValue) <= 0 || Number(reportedValue) >= 1000}
              className="tap-44 h-12 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {stage === "visibility" && (
        <div className="space-y-4">
          <div>
            <p className="label-broadcast text-muted-foreground">Where does this go?</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">Pick your audience</h2>
          </div>

          <button
            disabled={!!suspension}
            onClick={() => {
              if (suspension) return;
              const seen = JSON.parse(localStorage.getItem(SEEN_VIS_KEY) ?? "{}");
              if (!seen.public) setExplainOpen("public");
              else {
                setVisibility("public");
                setStage("confirm");
              }
            }}
            className={`tap-44 koth-stripe w-full rounded-3xl p-5 text-left ${suspension ? "cursor-not-allowed bg-muted text-muted-foreground opacity-60" : "bg-koth-red text-koth-white"}`}
          >
            <p className={`label-broadcast ${suspension ? "text-muted-foreground" : "text-koth-white/70"}`}>
              {suspension ? "Unavailable" : "Recommended"}
            </p>
            <p className="mt-1 text-lg font-bold">Enter Prize Pool</p>
            {suspension ? (
              <p className="mt-1 text-xs">
                Suspended until {new Date(suspension.until).toLocaleString()}.
                {suspension.reason ? ` Reason: ${suspension.reason}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-koth-white/80">
                Public. Eligible for prize money and the public podium. Replaces your previous public attempt for this challenge.
              </p>
            )}
          </button>

          <button
            onClick={() => {
              const seen = JSON.parse(localStorage.getItem(SEEN_VIS_KEY) ?? "{}");
              if (!seen.friends_only) setExplainOpen("friends_only");
              else {
                setVisibility("friends_only");
                setStage("confirm");
              }
            }}
            className="tap-44 w-full rounded-3xl border-2 border-border bg-card p-5 text-left text-foreground"
          >
            <p className="label-broadcast text-muted-foreground">Lower-stakes</p>
            <p className="mt-1 text-lg font-bold">Save to profile / friends only</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saved to your profile and your friends feed. Doesn't replace earlier attempts and isn't eligible for the prize pool.
            </p>
          </button>

          <Button
            variant="outline"
            onClick={() => setStage("report")}
            className="tap-44 h-12 w-full rounded-full"
          >
            Back
          </Button>
        </div>
      )}

      <VisibilityExplainer
        kind={explainOpen}
        onClose={() => setExplainOpen(null)}
        onConfirm={(v) => {
          const seen = JSON.parse(localStorage.getItem(SEEN_VIS_KEY) ?? "{}");
          seen[v] = true;
          localStorage.setItem(SEEN_VIS_KEY, JSON.stringify(seen));
          setVisibility(v);
          setExplainOpen(null);
          setStage("confirm");
        }}
      />

      {stage === "confirm" && captured && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <video
                src={captured.previewUrl}
                muted
                playsInline
                className="h-24 w-16 rounded-xl bg-black object-cover"
              />
              <div>
                <p className="label-broadcast text-muted-foreground">You're submitting</p>
                <p className="mono-stat text-2xl font-bold text-foreground">
                  {reportedValue} <span className="text-sm font-normal text-muted-foreground">{challenge.unit_label}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {visibility === "friends_only" ? "Profile + friends feed" : "Public · Prize pool eligible"}
            </span>
            <button
              onClick={() => setStage("visibility")}
              className="font-semibold text-koth-red"
            >
              Change
            </button>
          </div>
          {visibility === "public" && (
            <div className="rounded-2xl border border-koth-red/40 bg-koth-red/5 p-3 text-xs text-foreground">
              <p className="label-broadcast text-koth-red">Heads up — retake warning</p>
              <p className="mt-1">
                If this is a retake of a challenge you have already submitted for, your <span className="font-bold">old challenge video will be fully wiped</span> and replaced with this one. The new attempt appears on the leaderboard once an admin verifies it.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {visibility === "friends_only"
              ? "Saved to your profile and friends feed. Doesn't replace earlier attempts."
              : "This becomes your active entry and supersedes any previous public submission for this challenge."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setStage("visibility")} className="tap-44 h-12 rounded-full">
              Back
            </Button>
            <Button
              onClick={submit}
              className="tap-44 h-12 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              Submit
            </Button>
          </div>
        </div>
      )}

      {stage === "uploading" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-koth-red border-t-transparent" />
          <p className="label-broadcast text-muted-foreground">Uploading attempt…</p>
        </div>
      )}
    </div>
  );
}

function VisibilityExplainer({
  kind,
  onClose,
  onConfirm,
}: {
  kind: Visibility | null;
  onClose: () => void;
  onConfirm: (v: Visibility) => void;
}) {
  if (!kind) return null;
  const isPublic = kind === "public";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-xl">
        <p className="label-broadcast text-muted-foreground">
          {isPublic ? "Enter Prize Pool" : "Friends Feed Only"}
        </p>
        <h3 className="mt-1 text-lg font-bold text-foreground">
          {isPublic ? "Heads up — this goes public" : "Heads up — friends only"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {isPublic
            ? "Your video will appear on the public podium and is eligible for the prize pool. Anyone using KOTH can see and compare against your attempt."
            : "Your video won't be eligible for the prize pool, but you'll still show up on your Friends Podium and friends can see, like, and comment on it."}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="tap-44 h-11 flex-1 rounded-full">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(kind)}
            className="tap-44 h-11 flex-1 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
          >
            Got it, continue
          </Button>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          You won't see this message again.
        </p>
      </div>
    </div>
  );
}
