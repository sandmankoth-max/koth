/**
 * Camera capture module.
 * - Reverse button = flip front/back camera (does NOT mirror).
 * - Flash button = lightning. Back: torch via track constraint when supported.
 *   Front: full-screen bright white ring overlay (Snap/TikTok "front flash").
 * - Shutter = Snapchat-style clear circle. While recording, inner square fill.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw, X, Zap, ZapOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { NativeCameraRecorder } from "./native-camera-recorder";

export type CapturedVideo = {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  durationMs: number;
};

type Props = {
  onCancel: () => void;
  onCapture: (v: CapturedVideo) => void;
  maxSeconds?: number | null;
};

/**
 * Dispatches to a native AVFoundation/Camera2 recorder when running inside the
 * Capacitor iOS/Android app (Snapchat/TikTok-quality preview & recording).
 * Falls back to the browser MediaRecorder implementation on the web.
 */
export function CameraRecorder(props: Props) {
  if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.()) {
    return <NativeCameraRecorder {...props} />;
  }
  return <WebCameraRecorder {...props} />;
}

function WebCameraRecorder({ onCancel, onCapture, maxSeconds }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef<number>(0);

  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  useEffect(() => {
    document.body.classList.add("camera-active");
    return () => document.body.classList.remove("camera-active");
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    setError(null);
    setHasTorch(false);
    (async () => {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps: any = track?.getCapabilities?.() ?? {};
        setHasTorch(!!caps.torch);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera access blocked. Allow camera + mic and try again.");
      }
    })();
    return () => { active = false; stop(); };
  }, [facing, stop]);

  // Apply torch only when flash is on AND we're on the back cam.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const wantTorch = flashOn && facing === "environment" && hasTorch;
    track.applyConstraints({ advanced: [{ torch: wantTorch } as any] } as any).catch(() => {});
  }, [flashOn, facing, hasTorch, recording]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Date.now() - startTsRef.current), 200);
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
    const mimeType = mimeCandidates.find((m) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
    ) ?? "";
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const type = recorder.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      onCapture({
        blob,
        previewUrl: URL.createObjectURL(blob),
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
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    setRecording(false);
  }, []);

  useEffect(() => {
    if (!recording || !maxSeconds) return;
    if (elapsed >= maxSeconds * 1000) finish();
  }, [recording, elapsed, maxSeconds, finish]);

  const seconds = Math.floor(elapsed / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const frontFlashOn = flashOn && facing === "user";

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] overflow-hidden overscroll-none bg-black text-koth-white">
      {/* Preview */}
      <div className="absolute inset-0">
        {error ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center">
            <div>
              <p className="label-broadcast mb-2 text-koth-red">Camera unavailable</p>
              <p className="text-sm text-koth-white/80">{error}</p>
            </div>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
        )}
      </div>

      {/* Front "flash" — bright white ring overlay (Snap/TikTok behavior) */}
      {frontFlashOn && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] bg-white/85" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[6]"
            style={{ boxShadow: "inset 0 0 160px 60px rgba(255,255,255,0.95)" }}
          />
        </>
      )}

      {/* Top overlay: close left, timer centered, flip+flash stacked right */}
      <div
        className="camera-top-controls absolute inset-x-0 top-0 z-20 grid grid-cols-[44px_minmax(0,1fr)_44px] items-start gap-3 px-4 pb-3 pt-3"
      >
        <button
          onClick={() => { stop(); onCancel(); }}
          className="tap-44 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
          aria-label="Close camera"
        >
          <X className="h-6 w-6" aria-hidden />
        </button>
        <div className="pointer-events-none flex min-w-0 justify-center pt-1">
          {recording ? (
            <span className="pill mono-stat bg-koth-red text-koth-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-koth-white" />
              {mm}:{ss}{maxSeconds ? ` / ${String(Math.floor(maxSeconds/60)).padStart(2,"0")}:${String(maxSeconds%60).padStart(2,"0")}` : ""}
            </span>
          ) : maxSeconds ? (
            <span className="pill mono-stat bg-black/40 text-koth-white backdrop-blur">
              Max {Math.floor(maxSeconds/60)}:{String(maxSeconds%60).padStart(2,"0")}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3">
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            className="tap-44 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur disabled:opacity-50"
            aria-label="Switch camera"
            disabled={recording}
          >
            <RefreshCcw className="h-6 w-6" aria-hidden />
          </button>
          <button
            onClick={() => setFlashOn((v) => !v)}
            className={`tap-44 inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur ${flashOn ? "bg-koth-white text-koth-black" : "bg-black/40 text-koth-white"}`}
            aria-label={flashOn ? "Turn flash off" : "Turn flash on"}
            aria-pressed={flashOn}
          >
            {flashOn ? <Zap className="h-5 w-5" fill="currentColor" /> : <ZapOff className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Snapchat-style shutter */}
      <div
        className="camera-bottom-controls absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-8 px-6 pt-6"
      >
        <button
          onClick={recording ? finish : start}
          disabled={!!error}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className="tap-44 relative inline-flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-koth-white bg-transparent active:scale-95 transition-transform"
        >
          {recording ? (
            <span className="block h-7 w-7 rounded-md bg-koth-red" />
          ) : (
            <span className="block h-14 w-14 rounded-full bg-koth-white/0" />
          )}
        </button>
      </div>

      {facing === "environment" && flashOn && !hasTorch && !recording && (
        <p className="absolute inset-x-0 bottom-32 z-10 text-center text-[11px] text-koth-white/70">
          Torch not supported on this device — flash will be ignored.
        </p>
      )}
    </div>
  );
}
