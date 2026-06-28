import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,DELETE,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "86400",
  vary: "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function getEnv() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Backend is missing required configuration.");
  }
  return { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
}

async function requireUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("Unauthorized");
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getEnv();
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  const userId = data.user?.id;
  if (error || !userId) throw new Error("Unauthorized");
  return { userId };
}

function statusFor(message: string) {
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  if (message === "Not found") return 404;
  return 400;
}

export const Route = createFileRoute("/api/public/submissions")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const { userId } = await requireUser(request);
          const body = await request.json().catch(() => ({}));
          const action = String(body?.action ?? "").trim();
          if (action !== "cleanup_previous") throw new Error("Unknown action");
          const challengeId = String(body?.challengeId ?? "").trim();
          const keepSubmissionId = String(body?.keepSubmissionId ?? "").trim();
          const visibility = body?.visibility === "friends_only" ? "friends_only" : "public";
          if (!/^[0-9a-f-]{36}$/i.test(challengeId)) throw new Error("challengeId required");
          if (!/^[0-9a-f-]{36}$/i.test(keepSubmissionId)) throw new Error("keepSubmissionId required");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: suspended, error: suspErr } = await supabaseAdmin
            .from("submissions")
            .select("id, video_path")
            .eq("user_id", userId)
            .eq("challenge_id", challengeId)
            .eq("status", "disqualified")
            .neq("id", keepSubmissionId);
          if (suspErr) throw new Error(suspErr.message);

          let toDelete = suspended ?? [];

          if (visibility !== "friends_only") {
            const { data: pubs, error: pubErr } = await supabaseAdmin
              .from("submissions")
              .select("id, video_path")
              .eq("user_id", userId)
              .eq("challenge_id", challengeId)
              .eq("visibility", "public")
              .neq("status", "disqualified")
              .neq("id", keepSubmissionId);
            if (pubErr) throw new Error(pubErr.message);
            toDelete = [...toDelete, ...(pubs ?? [])];
          }

          if (toDelete.length === 0) return json({ ok: true, deleted: 0 });

          const paths = [...new Set(toDelete.map((s) => s.video_path).filter(Boolean))];
          if (paths.length > 0) {
            const { error: storageError } = await supabaseAdmin.storage
              .from("koth-videos")
              .remove(paths);
            if (storageError) console.error("[submissions:cleanup] storage error", storageError);
          }

          const ids = toDelete.map((s) => s.id);
          const { error: deleteError } = await supabaseAdmin
            .from("submissions")
            .delete()
            .in("id", ids)
            .eq("user_id", userId);
          if (deleteError) throw new Error(deleteError.message);

          return json({ ok: true, deleted: toDelete.length });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed";
          return json({ error: message }, statusFor(message));
        }
      },
      DELETE: async ({ request }) => {
        try {
          const { userId } = await requireUser(request);
          const body = await request.json().catch(() => ({}));
          const submissionId = String(body?.submissionId ?? "").trim();
          if (!/^[0-9a-f-]{36}$/i.test(submissionId)) throw new Error("submissionId required");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: sub, error: fetchError } = await supabaseAdmin
            .from("submissions")
            .select("id, user_id, video_path")
            .eq("id", submissionId)
            .maybeSingle();
          if (fetchError) throw new Error(fetchError.message);
          if (!sub) throw new Error("Not found");
          if (sub.user_id !== userId) throw new Error("Forbidden");

          if (sub.video_path) {
            const { error: storageError } = await supabaseAdmin.storage
              .from("koth-videos")
              .remove([sub.video_path]);
            if (storageError) console.error("[submissions:delete] storage error", storageError);
          }

          const { error: deleteError } = await supabaseAdmin
            .from("submissions")
            .delete()
            .eq("id", submissionId)
            .eq("user_id", userId);
          if (deleteError) throw new Error(deleteError.message);

          return json({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete submission";
          return json({ error: message }, statusFor(message));
        }
      },
    },
  },
});
