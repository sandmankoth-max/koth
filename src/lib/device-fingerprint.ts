import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { supabase } from "@/integrations/supabase/client";

let fpPromise: Promise<string> | null = null;

/** Get a stable per-browser/device hash. ~60% accurate; for ban-evasion only. */
export function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve("");
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
      .then((fp) => fp.get())
      .then((r) => r.visitorId)
      .catch(() => "");
  }
  return fpPromise;
}

/** Throws if the current device is on the ban list. */
export async function assertDeviceNotBanned(): Promise<string> {
  const fp = await getDeviceFingerprint();
  if (!fp) return "";
  const { data } = await supabase.rpc("is_fingerprint_banned" as any, { _fp: fp });
  if (data === true) {
    throw new Error("This device is not permitted to create or use an account on KOTH.");
  }
  return fp;
}

/** Record fingerprint for the signed-in user (no-op if no session). */
export async function recordDeviceFingerprint(userId: string): Promise<void> {
  try {
    const fp = await getDeviceFingerprint();
    if (!fp || !userId) return;
    await supabase
      .from("device_fingerprints" as any)
      .upsert(
        { user_id: userId, fp_hash: fp, user_agent: navigator.userAgent.slice(0, 300) },
        { onConflict: "user_id,fp_hash" },
      );
  } catch {
    // non-fatal
  }
}
