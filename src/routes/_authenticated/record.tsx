import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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

type Stage = "intro" | "camera" | "preview" | "report" | "confirm" | "uploading";

function Record() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("intro");
  const [captured, setCaptured] = useState<CapturedVideo | null>(null);
  const [reportedValue, setReportedValue] = useState("");
  const [challenge, setChallenge] = useState<any>(null);

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
    return () => {
      if (captured?.previewUrl) URL.revokeObjectURL(captured.previewUrl);
    };
  }, [captured]);

  if (!challenge) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="label-broadcast text-muted-foreground">No active challenge</p>
        <p className="mt-2 text-sm text-muted-foreground">Check back Monday at 10am.</p>
      </div>
    );
  }

  if (stage === "camera") {
    return (
      <CameraRecorder
        onCancel={() => setStage("intro")}
        onCapture={(v) => {
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

      // Find prior submissions for this challenge by this user so we can fully
      // replace them: delete their video files from storage and the rows themselves.
      const { data: prior } = await supabase
        .from("submissions")
        .select("id, video_path")
        .eq("user_id", user.id)
        .eq("challenge_id", challenge.id);

      const { error: insErr } = await supabase.from("submissions").insert({
        user_id: user.id,
        challenge_id: challenge.id,
        video_path: path,
        self_reported_value: Number(reportedValue),
      });
      if (insErr) throw insErr;

      if (prior && prior.length > 0) {
        const paths = prior.map((p) => p.video_path).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from("koth-videos").remove(paths);
        }
        await supabase
          .from("submissions")
          .delete()
          .in(
            "id",
            prior.map((p) => p.id),
          );
      }

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
        <p className="mt-2 text-xs text-koth-white/70">Live capture only — no uploads from camera roll.</p>
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
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={reportedValue}
            onChange={(e) => setReportedValue(e.target.value)}
            autoFocus
            placeholder="0"
            className="mono-stat h-20 rounded-2xl text-center text-4xl font-bold"
          />
          <p className="text-center text-sm text-muted-foreground">{challenge.unit_label}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setStage("preview")}
              className="tap-44 h-12 rounded-full"
            >
              Back
            </Button>
            <Button
              onClick={() => setStage("confirm")}
              disabled={!reportedValue || Number(reportedValue) < 0}
              className="tap-44 h-12 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              Next
            </Button>
          </div>
        </div>
      )}

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
          <p className="text-xs text-muted-foreground">
            This becomes your active entry and supersedes any previous submission for this challenge.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setStage("report")} className="tap-44 h-12 rounded-full">
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
