import { supabase } from "@/integrations/supabase/client";

const AVATAR_CACHE_KEY = "koth.avatarSignedUrls.v1";
const AVATAR_CACHE_SKEW_MS = 60_000;
const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

function readStoredAvatarCache(path: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AVATAR_CACHE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Record<string, { url: string; expiresAt: number }>;
    const entry = stored[path];
    if (!entry || entry.expiresAt <= Date.now() + AVATAR_CACHE_SKEW_MS) return null;
    avatarUrlCache.set(path, entry);
    return entry.url;
  } catch {
    return null;
  }
}

function writeStoredAvatarCache(path: string, entry: { url: string; expiresAt: number }) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(AVATAR_CACHE_KEY);
    const stored = raw ? (JSON.parse(raw) as Record<string, { url: string; expiresAt: number }>) : {};
    stored[path] = entry;
    window.localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // Best-effort cache only.
  }
}

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
  if (unitType === "count_reps") {
    const n = Number(value);
    const isInt = n % 1 === 0;
    const label = (unitLabel || "reps").trim();
    return `${isInt ? n.toFixed(0) : (Math.round(n * 10) / 10).toFixed(1)} ${label}`;
  }
  const n = Number(value);
  const isInt = Number.isFinite(n) && n % 1 === 0;
  return `${isInt ? n : (Math.round(n * 10) / 10).toFixed(1)} ${unitLabel}`;
}

export function shortUnitLabel(unitType: string, unitLabel: string) {
  // formatValue already embeds the unit for these built-ins, so avoid
  // rendering a duplicate ("80s sec").
  if (unitType === "time_seconds") return "";
  if (unitType === "count_reps") return "";
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

export function getCachedAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  const memoryEntry = avatarUrlCache.get(path);
  if (memoryEntry && memoryEntry.expiresAt > Date.now() + AVATAR_CACHE_SKEW_MS) {
    return memoryEntry.url;
  }
  return readStoredAvatarCache(path);
}

export function primeAvatarSignedUrl(path: string | null, url: string | null, expiresIn = 3600) {
  if (!path || !url || path.startsWith("http")) return;
  const entry = { url, expiresAt: Date.now() + expiresIn * 1000 };
  avatarUrlCache.set(path, entry);
  writeStoredAvatarCache(path, entry);
}

export async function getAvatarSignedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  // Avatar URLs may be stored as a raw storage path or a full URL.
  if (path.startsWith("http")) return path;
  const cached = getCachedAvatarUrl(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from("koth-avatars").createSignedUrl(path, expiresIn);
  const signedUrl = data?.signedUrl ?? null;
  primeAvatarSignedUrl(path, signedUrl, expiresIn);
  return signedUrl;
}
