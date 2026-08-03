/**
 * Applies a trim range to a recorded clip, producing a new blob that contains
 * only the selected section. Uses real-time capture of the playing element via
 * `captureStream()` + MediaRecorder, which is the only client-side path that
 * works in a WebView without a native encoder.
 *
 * If the platform can't capture, the original blob is returned unchanged so a
 * submission never fails just because trimming isn't available.
 */
export async function applyTrim(
  blob: Blob,
  mimeType: string,
  range: { start: number; end: number } | null,
): Promise<{ blob: Blob; mimeType: string }> {
  if (!range || range.end - range.start <= 0.05) return { blob, mimeType };

  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = false;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("load failed"));
    });

    const capture = (video as any).captureStream?.bind(video)
      ?? (video as any).mozCaptureStream?.bind(video);
    if (typeof capture !== "function" || typeof MediaRecorder === "undefined") {
      return { blob, mimeType };
    }

    video.currentTime = range.start;
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });

    const stream: MediaStream = capture();
    const candidates = [
      "video/mp4;codecs=h264,aac",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const outType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const recorder = new MediaRecorder(stream, outType ? { mimeType: outType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || outType || mimeType }));
    });

    recorder.start(200);
    await video.play();
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (video.currentTime >= range.end || video.ended) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    video.pause();
    if (recorder.state !== "inactive") recorder.stop();

    const out = await done;
    if (!out.size) return { blob, mimeType };
    return { blob: out, mimeType: out.type || mimeType };
  } catch {
    return { blob, mimeType };
  } finally {
    URL.revokeObjectURL(url);
  }
}
