import { createFileRoute } from "@tanstack/react-router";

/**
 * Push fanout endpoint. Called by a Postgres AFTER INSERT trigger on
 * public.notifications via pg_net. Looks up the recipient's device tokens
 * and delivers a native push through FCM v1 (APNs on iOS).
 *
 * Auth: shared secret in `x-push-secret` header, checked against
 * public.push_config.secret (row managed entirely inside the database).
 */
export const Route = createFileRoute("/api/public/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const providedSecret = request.headers.get("x-push-secret") ?? "";
          let body: { notification_id?: string };
          try {
            body = (await request.json()) as { notification_id?: string };
          } catch {
            return new Response("bad json", { status: 400 });
          }
          if (!body.notification_id) return new Response("missing notification_id", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: cfg, error: cfgErr } = await (supabaseAdmin as any)
            .from("push_config")
            .select("secret, enabled")
            .eq("id", 1)
            .maybeSingle();
          if (cfgErr || !cfg) return new Response("no config", { status: 500 });
          if (!cfg.enabled) return new Response("disabled", { status: 200 });
          if (!timingSafeEq(providedSecret, cfg.secret as string)) {
            return new Response("unauthorized", { status: 401 });
          }

          const { data: notif, error: notifErr } = await supabaseAdmin
            .from("notifications")
            .select("user_id, type, payload")
            .eq("id", body.notification_id)
            .maybeSingle();
          if (notifErr || !notif) return new Response("notification not found", { status: 404 });

          const { data: tokens } = await supabaseAdmin
            .from("device_tokens")
            .select("token, platform")
            .eq("user_id", notif.user_id)
            .in("platform", ["ios", "android"]);

          if (!tokens || tokens.length === 0) {
            return Response.json({ sent: 0, reason: "no devices" });
          }

          const iosTokens = tokens.filter((t) => t.platform === "ios");
          const androidTokens = tokens.filter((t) => t.platform === "android");

          const { title, body: bodyText } = formatPush(notif.type as string, notif.payload as Record<string, unknown>);
          const dataPayload = {
            notification_id: body.notification_id!,
            type: notif.type as string,
          };

          type SendResult = { token: string; ok: boolean; bad: boolean; error?: string };
          const allResults: SendResult[] = [];

          // Android → FCM
          if (androidTokens.length > 0) {
            const svcJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
            if (!svcJson) {
              console.error("[send-push] FCM_SERVICE_ACCOUNT_JSON not set");
            } else {
              try {
                const svc = JSON.parse(svcJson) as {
                  client_email: string;
                  private_key: string;
                  project_id: string;
                };
                const accessToken = await getFcmAccessToken(svc);
                const results = await Promise.allSettled(
                  androidTokens.map((t) =>
                    sendFcm(svc.project_id, accessToken, t.token, title, bodyText, dataPayload),
                  ),
                );
                results.forEach((r, i) => {
                  if (r.status === "fulfilled") {
                    allResults.push({ token: androidTokens[i].token, ok: true, bad: false });
                  } else {
                    const msg = String(r.reason ?? "");
                    const bad = msg.includes("UNREGISTERED") || msg.includes("INVALID_ARGUMENT") || msg.includes("NOT_FOUND");
                    console.error("[send-push] fcm error", msg);
                    allResults.push({ token: androidTokens[i].token, ok: false, bad, error: msg });
                  }
                });
              } catch (e) {
                console.error("[send-push] fcm setup error", e);
              }
            }
          }

          // iOS → APNs (direct)
          if (iosTokens.length > 0) {
            try {
              const jwt = await getApnsJwt();
              const bundleId = process.env.APNS_BUNDLE_ID;
              const host = process.env.APNS_ENVIRONMENT === "production"
                ? "api.push.apple.com"
                : "api.sandbox.push.apple.com";
              if (!bundleId) {
                console.error("[send-push] APNS_BUNDLE_ID not set");
              } else {
                const results = await Promise.allSettled(
                  iosTokens.map((t) =>
                    sendApns(host, jwt, bundleId, t.token, title, bodyText, dataPayload),
                  ),
                );
                results.forEach((r, i) => {
                  if (r.status === "fulfilled") {
                    allResults.push({ token: iosTokens[i].token, ok: true, bad: false });
                  } else {
                    const msg = String(r.reason ?? "");
                    const bad = msg.includes("BadDeviceToken") || msg.includes("Unregistered") || msg.includes("DeviceTokenNotForTopic");
                    console.error("[send-push] apns error", msg);
                    allResults.push({ token: iosTokens[i].token, ok: false, bad, error: msg });
                  }
                });
              }
            } catch (e) {
              console.error("[send-push] apns setup error", e);
            }
          }

          const badTokens = allResults.filter((r) => r.bad).map((r) => r.token);
          const sent = allResults.filter((r) => r.ok).length;
          const failed = allResults.length - sent;

          if (badTokens.length) {
            await supabaseAdmin.from("device_tokens").delete().in("token", badTokens);
          }

          return Response.json({ sent, failed, pruned: badTokens.length });

        } catch (e) {
          console.error("[send-push] fatal", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    bin,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function importPkcs8Ecdsa(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    bin,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// Cached APNs JWT (valid ~1h; refresh a bit early).
let cachedApnsJwt: { token: string; expiresAt: number } | null = null;

async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsJwt && cachedApnsJwt.expiresAt > now + 60) {
    return cachedApnsJwt.token;
  }
  const keyPem = process.env.APNS_AUTH_KEY_P8;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!keyPem || !keyId || !teamId) {
    throw new Error("APNS_AUTH_KEY_P8/APNS_KEY_ID/APNS_TEAM_ID not set");
  }
  const header = { alg: "ES256", typ: "JWT", kid: keyId };
  const claim = { iss: teamId, iat: now };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await importPkcs8Ecdsa(keyPem);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  // APNs allows tokens up to 1 hour; refresh at ~50 min.
  cachedApnsJwt = { token: jwt, expiresAt: now + 50 * 60 };
  return jwt;
}

async function sendApns(
  host: string,
  jwt: string,
  bundleId: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: "default",
      },
      ...data,
    }),
  });
  if (!res.ok) {
    let reason = "";
    try {
      const j = (await res.json()) as { reason?: string };
      reason = j.reason ?? "";
    } catch {
      reason = await res.text();
    }
    throw new Error(`apns ${res.status} ${reason}`);
  }
  return { ok: true };
}


async function getFcmAccessToken(svc: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: svc.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await importPkcs8(svc.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function sendFcm(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        apns: {
          payload: {
            aps: {
              sound: "default",
              "mutable-content": 1,
              alert: { title, body },
            },
          },
        },
        android: {
          priority: "HIGH",
          notification: { sound: "default" },
        },
        data,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`fcm ${res.status} ${txt}`);
  }
  return res.json();
}

function formatPush(type: string, payload: Record<string, unknown>): { title: string; body: string } {
  const p = payload || {};
  const u = p.from_username ? `@${p.from_username}` : "Someone";
  const preview = (s: unknown) =>
    typeof s === "string" && s.length > 0 ? `: "${s.length > 60 ? s.slice(0, 60) + "…" : s}"` : "";
  switch (type) {
    case "new_challenge":
      return { title: "New challenge is live", body: (p.title as string) ?? "This week's challenge just dropped" };
    case "challenge_closed":
      return { title: "Challenge closed", body: `${(p.title as string) ?? "This week's challenge"} — new one drops Monday at 10am` };
    case "deadline_reminder_24h":
      return { title: "1 day left", body: `Submit ${(p.title as string) ?? "today's challenge"} before time runs out` };
    case "deadline_reminder":
      return { title: "1 hour left", body: `${(p.title as string) ?? "Today's challenge"} closes soon` };
    case "podium_lost":
      return { title: "Kicked off the podium", body: p.overtaken_by_username ? `@${p.overtaken_by_username} passed you` : "Someone passed you" };
    case "podium_gained":
      return { title: "You made the podium", body: `You're at #${p.new_rank ?? "?"}` };
    case "time_verified":
      return { title: "Entry verified", body: p.value != null ? String(p.value) : "Your submission was verified" };
    case "time_disqualified":
      return { title: "Submission rejected", body: (p.reason as string) ?? "Your submission was rejected" };
    case "friend_request":
      return { title: "Friend request", body: `${u} sent you a friend request` };
    case "friend_accepted":
      return { title: "Friend request accepted", body: `${u} accepted your friend request` };
    case "like_video":
      return { title: "New like", body: `${u} liked your video` };
    case "like_comment":
      return { title: "New like", body: `${u} liked your comment` };
    case "comment_video":
      return { title: "New comment", body: `${u} commented on your video${preview(p.preview)}` };
    case "reply_comment":
      return { title: "New reply", body: `${u} replied to your comment${preview(p.preview)}` };
    case "reply_challenge_comment":
      return { title: "New reply", body: `${u} replied to your challenge comment${preview(p.preview)}` };
    case "tag_comment":
      return { title: "You were mentioned", body: `${u} mentioned you${preview(p.preview)}` };
    case "tag_challenge_comment":
      return { title: "You were mentioned", body: `${u} mentioned you${preview(p.preview)}` };
    case "admin_message":
      return { title: "KOTH", body: (p.message as string) ?? "New message from admin" };
    case "winners_announcement":
      return {
        title: "Winners announced",
        body: `1st @${p.first_username}, 2nd @${p.second_username}, 3rd @${p.third_username}`,
      };
    default:
      return { title: "KOTH", body: "New notification" };
  }
}
