/**
 * Native camera recorder (iOS/Android via Capacitor).
 * Uses @capacitor-community/camera-preview to render the native AVFoundation /
 * Camera2 preview layer BEHIND the WebView. HTML controls float on top.
 *
 * Same Props / CapturedVideo shape as the web CameraRecorder so callers don't
 * have to change.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCcw, X, Zap, ZapOff } from "lucide-react";
import { CameraPreview } from "@capacitor-community/camera-preview";
import { Filesystem } from "@capacitor/filesystem";
import type { CapturedVideo } from "./camera-recorder";

type Props = {
  onCancel: () => void;
  onCapture: (v: CapturedVideo) => void;
  maxSeconds?: number | null;
};

export function NativeCameraRecorder({ onCancel, onCapture, maxSeconds }: Props) {
  const [facing, setFacing] = useState<"front" | "rear">("rear");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTsRef = useRef(0);
  const startedRef = useRef(false);

  // Make body transparent so the native camera layer shows through.
  useEffect(() => {
    const prevBody = document.body.style.background;
    const prevHtml = document.documentElement.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    document.body.classList.add("camera-active");
    return () => {
      document.body.style.background = prevBody;
      document.documentElement.style.background = prevHtml;
      document.body.classList.remove("camera-active");
    };
  }, []);

  const startPreview = useCallback(async (pos: "front" | "rear") => {
    try {
      try { await CameraPreview.stop(); } catch {}
      await CameraPreview.start({
        position: pos,
        parent: "cameraPreview",
        className: "cameraPreview",
        toBack: true,
        disableAudio: false,
        enableHighResolution: true,
      } as any);
      startedRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera unavailable");
    }
  }, []);

  useEffect(() => {
    startPreview(facing);
    return () => {
      (async () => { try { await CameraPreview.stop(); } catch {} })();
      startedRef.current = false;
    };
  }, [facing, startPreview]);

  // Flash (torch on rear). Front "flash" handled by white overlay below.
  useEffect(() => {
    (async () => {
      try {
        await CameraPreview.setFlashMode({
          flashMode: flashOn && facing === "rear" ? "torch" : "off",
        } as any);
      } catch {}
    })();
  }, [flashOn, facing]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Date.now() - startTsRef.current), 200);
    return () => clearInterval(id);
  }, [recording]);

  const start = useCallback(async () => {
    try {
      await CameraPreview.startRecordVideo({
        position: facing,
        quality: 85,
        withFlash: flashOn && facing === "rear",
      } as any);
      startTsRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start recording");
    }
  }, [facing, flashOn]);

  const finish = useCallback(async () => {
    try {
      const result: any = await CameraPreview.stopRecordVideo();
      setRecording(false);
      const path: string = result?.videoFilePath || result?.path || "";
      if (!path) throw new Error("No video file returned");
      // Read file into a Blob so the rest of the app (upload, preview) works unchanged.
      const read = await Filesystem.readFile({ path });
      const base64 = typeof read.data === "string" ? read.data : "";
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const mimeType = "video/mp4";
      const blob = new Blob([bytes], { type: mimeType });
      onCapture({
        blob,
        previewUrl: URL.createObjectURL(blob),
        mimeType,
        durationMs: Date.now() - startTsRef.current,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save recording");
      setRecording(false);
    }
  }, [onCapture]);

  useEffect(() => {
    if (!recording || !maxSeconds) return;
    if (elapsed >= maxSeconds * 1000) finish();
  }, [recording, elapsed, maxSeconds, finish]);

  const seconds = Math.floor(elapsed / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const frontFlashOn = flashOn && facing === "front";

  return (
    <div id="cameraPreview" className="fixed inset-0 z-[100] h-[100dvh] overflow-hidden overscroll-none text-koth-white" style={{ background: "transparent" }}>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center">
          <div>
            <p className="label-broadcast mb-2 text-koth-red">Camera unavailable</p>
            <p className="text-sm text-koth-white/80">{error}</p>
          </div>
        </div>
      )}

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

      <div
        className="camera-top-controls absolute inset-x-0 top-0 z-20 grid grid-cols-[44px_minmax(0,1fr)_44px] items-start gap-3 px-4 pb-3 pt-3"
      >
        <button
          onClick={async () => { try { await CameraPreview.stop(); } catch {} onCancel(); }}
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
            onClick={() => setFacing((f) => (f === "front" ? "rear" : "front"))}
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
    </div>
  );
}
