/**
 * Camera capture module — isolated so the underlying engine can be swapped
 * for `@capacitor/camera` / `@capacitor-community/media-capture` later without
 * changing any caller.
 *
 * Contract:
 *   - `recordVideo(): Promise<CapturedVideo>` returns a Blob + a local preview URL.
 *   - The host UI never reads `navigator.mediaDevices` directly; it only uses
 *     this component and the `CapturedVideo` shape it returns.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw, X, Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CapturedVideo = {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  durationMs: number;
};

type Props = {
  onCancel: () => void;
  onCapture: (v: CapturedVideo) => void;
  /** Hard cap; recorder auto-stops at this many seconds when set. */
  maxSeconds?: number | null;
};

export function CameraRecorder({ onCancel, onCapture, maxSeconds }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef<number>(0);

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    setError(null);
    (async () => {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Camera access was blocked. Allow camera and microphone, then try again.",
        );
      }
    })();
    return () => {
      active = false;
      stop();
    };
  }, [facing, stop]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Date.now() - startTsRef.current), 250);
    return () => clearInterval(id);
  }, [recording]);

  const start = useCallback(() => {
    if (!streamRef.current) return;
    const mimeCandidates = [
      "video/mp4;codecs=h264,aac",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType =
      mimeCandidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ??
      "";
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const previewUrl = URL.createObjectURL(blob);
      onCapture({
        blob,
        previewUrl,
        mimeType: type,
        durationMs: Date.now() - startTsRef.current,
      });
    };
    recorderRef.current = recorder;
    startTsRef.current = Date.now();
    setElapsed(0);
    recorder.start(250);
    setRecording(true);
  }, [onCapture]);

  const finish = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  // Auto-stop when reaching the per-challenge cap.
  useEffect(() => {
    if (!recording || !maxSeconds) return;
    if (elapsed >= maxSeconds * 1000) finish();
  }, [recording, elapsed, maxSeconds, finish]);

  const seconds = Math.floor(elapsed / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-koth-black text-koth-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => {
            stop();
            onCancel();
          }}
          className="tap-44 rounded-full p-2"
          aria-label="Close camera"
        >
          <X className="h-6 w-6" aria-hidden />
        </button>
        {recording ? (
          <span className="pill mono-stat bg-koth-red text-koth-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-koth-white" />
            {mm}:{ss}{maxSeconds ? ` / ${String(Math.floor(maxSeconds/60)).padStart(2,"0")}:${String(maxSeconds%60).padStart(2,"0")}` : ""}
          </span>
        ) : maxSeconds ? (
          <span className="pill mono-stat bg-koth-white/10 text-koth-white">
            Max {maxSeconds}s
          </span>
        ) : <span />}
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="tap-44 rounded-full p-2"
          aria-label="Switch camera"
          disabled={recording}
        >
          <RefreshCcw className="h-6 w-6" aria-hidden />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-koth-black">
        {error ? (
          <div className="px-6 text-center">
            <p className="label-broadcast mb-2 text-koth-red">Camera unavailable</p>
            <p className="text-sm text-koth-white/80">{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-8 px-6 py-8">
        {!recording ? (
          <Button
            onClick={start}
            disabled={!!error}
            aria-label="Start recording"
            className="tap-44 h-20 w-20 rounded-full border-4 border-koth-white bg-koth-red p-0 hover:bg-koth-red"
          >
            <Circle className="h-6 w-6 fill-koth-white text-koth-white" aria-hidden />
          </Button>
        ) : (
          <Button
            onClick={finish}
            aria-label="Stop recording"
            className="tap-44 h-20 w-20 rounded-full border-4 border-koth-white bg-koth-red p-0 hover:bg-koth-red"
          >
            <Square className="h-7 w-7 fill-koth-white text-koth-white" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
