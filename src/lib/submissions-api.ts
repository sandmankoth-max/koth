import { supabase } from "@/integrations/supabase/client";

const PROD_ORIGIN = "https://pixel-perfect-clone-25865.lovable.app";

function apiUrl(path: string) {
  if (typeof window === "undefined") return path;
  const cap = (window as any).Capacitor;
  const isNative =
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "ionic:" ||
    window.location.protocol === "file:" ||
    Boolean(cap?.isNativePlatform?.());
  return isNative ? `${PROD_ORIGIN}${path}` : path;
}

async function authedFetch(path: string, init: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in again.");

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[submissions-api] fetch failed", error);
    throw new Error("Network request failed. Try again.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}

export async function deleteOwnSubmissionApi(submissionId: string) {
  return authedFetch("/api/public/submissions", {
    method: "DELETE",
    body: JSON.stringify({ submissionId }),
  });
}

export async function cleanupPreviousSubmissionsApi(input: {
  challengeId: string;
  keepSubmissionId: string;
  visibility: "public" | "friends_only";
}) {
  return authedFetch("/api/public/submissions", {
    method: "POST",
    body: JSON.stringify({ action: "cleanup_previous", ...input }),
  });
}
