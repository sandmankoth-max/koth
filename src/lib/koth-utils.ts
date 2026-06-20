import { supabase } from "@/integrations/supabase/client";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Format value for display based on unit type. */
export function formatValue(value: number | null | undefined, unitType: string, unitLabel: string) {
  if (value == null) return "—";
  if (unitType === "time_seconds") {
    const total = Number(value);
    const isInt = total % 1 === 0;
    return `${total.toFixed(isInt ? 0 : 2)}s`;
  }
  if (unitType === "count_reps") return `${Math.round(Number(value))}`;
  return `${value} ${unitLabel}`;
}

export function shortUnitLabel(unitType: string, unitLabel: string) {
  if (unitType === "time_seconds") return "sec";
  if (unitType === "count_reps") return "reps";
  return unitLabel;
}

/** Countdown chunks (D, H, M, S) given a future date. */
export function countdownParts(target: Date | string) {
  const ms = new Date(target).getTime() - Date.now();
  const clamped = Math.max(0, ms);
  const days = Math.floor(clamped / 86_400_000);
  const hours = Math.floor((clamped % 86_400_000) / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  return { days, hours, minutes, seconds, expired: clamped === 0 };
}

/** Build a signed playback URL for a private video path. */
export async function getVideoSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("koth-videos").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function getAvatarSignedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  // Avatar URLs may be stored as a raw storage path or a full URL.
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("koth-avatars").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
