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

/* ---------------- video signed-url cache + batching ---------------- */

const videoUrlCache = new Map<string, { url: string; expiresAt: number }>();
const VIDEO_SKEW_MS = 60_000;
let videoQueue: string[] = [];
let videoFlush: Promise<void> | null = null;
const videoWaiters = new Map<string, ((u: string | null) => void)[]>();

export function getCachedVideoUrl(path: string | null): string | null {
  if (!path) return null;
  const e = videoUrlCache.get(path);
  return e && e.expiresAt > Date.now() + VIDEO_SKEW_MS ? e.url : null;
}

async function flushVideoQueue(expiresIn: number) {
  const paths = Array.from(new Set(videoQueue));
  videoQueue = [];
  videoFlush = null;
  if (!paths.length) return;
  const { data } = await supabase.storage.from("koth-videos").createSignedUrls(paths, expiresIn);
  const byPath = new Map((data ?? []).map((d: any) => [d.path, d.signedUrl as string | null]));
  for (const p of paths) {
    const url = byPath.get(p) ?? null;
    if (url) videoUrlCache.set(p, { url, expiresAt: Date.now() + expiresIn * 1000 });
    (videoWaiters.get(p) ?? []).forEach((fn) => fn(url));
    videoWaiters.delete(p);
  }
}

/** Build a signed playback URL for a private video path (cached + batched). */
export async function getVideoSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const cached = getCachedVideoUrl(path);
  if (cached) return cached;
  return new Promise<string | null>((resolve) => {
    videoWaiters.set(path, [...(videoWaiters.get(path) ?? []), resolve]);
    videoQueue.push(path);
    if (!videoFlush) {
      videoFlush = Promise.resolve().then(() => {
        // Coalesce all requests made in the same tick into one API call.
        window.setTimeout(() => void flushVideoQueue(expiresIn), 0);
      });
    }
  });
}

/** Warm the cache for a list of video paths in a single request. */
export async function prefetchVideoSignedUrls(paths: string[], expiresIn = 3600) {
  const missing = paths.filter((p) => p && !getCachedVideoUrl(p));
  if (!missing.length) return;
  await Promise.all(missing.map((p) => getVideoSignedUrl(p, expiresIn)));
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

let avatarQueue: string[] = [];
let avatarScheduled = false;
const avatarWaiters = new Map<string, ((u: string | null) => void)[]>();

async function flushAvatarQueue(expiresIn: number) {
  const paths = Array.from(new Set(avatarQueue));
  avatarQueue = [];
  avatarScheduled = false;
  if (!paths.length) return;
  const { data } = await supabase.storage.from("koth-avatars").createSignedUrls(paths, expiresIn);
  const byPath = new Map((data ?? []).map((d: any) => [d.path, d.signedUrl as string | null]));
  for (const p of paths) {
    const url = byPath.get(p) ?? null;
    primeAvatarSignedUrl(p, url, expiresIn);
    (avatarWaiters.get(p) ?? []).forEach((fn) => fn(url));
    avatarWaiters.delete(p);
  }
}

export async function getAvatarSignedUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  // Avatar URLs may be stored as a raw storage path or a full URL.
  if (path.startsWith("http")) return path;
  const cached = getCachedAvatarUrl(path);
  if (cached) return cached;
  // Batch every avatar requested in the same tick into a single API call so a
  // list of 20 avatars costs one round-trip instead of 20.
  return new Promise<string | null>((resolve) => {
    avatarWaiters.set(path, [...(avatarWaiters.get(path) ?? []), resolve]);
    avatarQueue.push(path);
    if (!avatarScheduled) {
      avatarScheduled = true;
      window.setTimeout(() => void flushAvatarQueue(expiresIn), 0);
    }
  });
}

