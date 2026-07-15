// Sends FCM push notifications when a new row is inserted into public.notifications.
// Called by a Postgres trigger via pg_net. Auth: shared secret in X-Push-Secret header.
//
// Required env:
//   PUSH_WEBHOOK_SECRET       - shared secret with the DB trigger
//   FCM_SERVICE_ACCOUNT_JSON  - full Firebase service account JSON (single line)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - to look up device tokens

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Any = any;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-push-secret, content-type",
};

function b64url(bytes: Uint8Array | string): string {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    bin,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(sa: Any): Promise<string> {
  if (cachedToken && cachedToken.exp - 60 > Math.floor(Date.now() / 1000)) {
    return cachedToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${JSON.stringify(j)}`);
  cachedToken = { token: j.access_token, exp: now + Number(j.expires_in ?? 3600) };
  return cachedToken.token;
}

function deriveTitleBody(type: string, payload: Any): { title: string; body: string } {
  const p = payload ?? {};
  const from = p.from_username ? `@${p.from_username}` : "Someone";
  const preview = typeof p.preview === "string" ? p.preview : "";
  switch (type) {
    case "friend_request":
      return { title: "New friend request", body: `${from} wants to be your friend` };
    case "friend_accepted":
      return { title: "Friend request accepted", body: `${from} accepted your request` };
    case "like_video":
      return { title: "New like", body: `${from} liked your video` };
    case "like_comment":
      return { title: "New like", body: `${from} liked your comment` };
    case "comment_video":
      return { title: "New comment", body: `${from}: ${preview}` };
    case "reply_comment":
    case "reply_challenge_comment":
      return { title: "New reply", body: `${from}: ${preview}` };
    case "tag_comment":
    case "tag_challenge_comment":
      return { title: "You were tagged", body: `${from}: ${preview}` };
    case "time_verified":
      return { title: "Time verified", body: "Your submission was verified" };
    case "time_disqualified":
      return { title: "Submission disqualified", body: p.reason || "Your submission was disqualified" };
    case "podium_gained":
      return { title: "You made the podium!", body: `You're now rank #${p.new_rank}` };
    case "podium_lost":
      return { title: "Podium lost", body: `${p.overtaken_by_username ? "@" + p.overtaken_by_username : "Someone"} passed you` };
    case "new_challenge":
      return { title: "New challenge", body: p.title || "A new challenge is live" };
    case "challenge_closed":
      return { title: "Challenge closed", body: p.title || "A challenge has ended" };
    case "deadline_reminder":
      return { title: "1 hour left", body: p.title || "Submit before time runs out" };
    case "deadline_reminder_24h":
      return { title: "24 hours left", body: p.title || "Don't forget to submit" };
    case "winners_announcement":
      return { title: p.headline || "Winners announced", body: p.note || "Check the leaderboard" };
    case "admin_message":
      return { title: "Message from admin", body: p.message || "" };
    default:
      return { title: "KOTH", body: p.message || p.preview || "You have a new notification" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const secret = req.headers.get("x-push-secret");
    if (!secret || secret !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
      return new Response("unauthorized", { status: 401, headers: CORS });
    }
    const body = await req.json();
    const { user_id, type, payload, notification_id } = body ?? {};
    if (!user_id || !type) {
      return new Response("bad request", { status: 400, headers: CORS });
    }

    const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("FCM_SERVICE_ACCOUNT_JSON not set");
    const sa = JSON.parse(saJson);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", user_id);
    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const { title, body: bodyText } = deriveTitleBody(type, payload);
    const accessToken = await getAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    const results = await Promise.allSettled(
      tokens.map((t) =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title, body: bodyText },
              data: {
                type: String(type),
                notification_id: String(notification_id ?? ""),
                payload: JSON.stringify(payload ?? {}),
              },
              apns: {
                payload: { aps: { sound: "default", badge: 1 } },
              },
            },
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const errText = await r.text();
            // Clean up unregistered tokens
            if (r.status === 404 || r.status === 400) {
              if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(errText)) {
                await supabase.from("device_tokens").delete().eq("token", t.token);
              }
            }
            throw new Error(`FCM ${r.status}: ${errText}`);
          }
          return r.json();
        }),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;
    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[send-push] error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
