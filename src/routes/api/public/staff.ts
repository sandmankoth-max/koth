import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type StaffAccount = {
  user_id: string;
  role: "admin" | "moderator";
  username: string;
  display_name: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
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

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized");

  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = getEnv();
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) throw new Error("Unauthorized");

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleError) throw new Error(roleError.message);
  if (!isAdmin) throw new Error("Forbidden");

  return { userId };
}

async function listStaff(): Promise<StaffAccount[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, user_id")
    .in("role", ["admin", "moderator"]);
  if (error) throw new Error(error.message);

  const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
  if (ids.length === 0) return [];

  const { data: profs, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ids);
  if (profErr) throw new Error(profErr.message);

  const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return (roles ?? []).map((r) => {
    const p = byId.get(r.user_id) as any;
    return {
      user_id: r.user_id,
      role: r.role as "admin" | "moderator",
      username: p?.username ?? "(unknown)",
      display_name: p?.display_name ?? null,
    };
  });
}

function validateModeratorInput(input: any) {
  const username = String(input?.username ?? "").trim().toLowerCase();
  const password = String(input?.password ?? "");
  const displayName = String(input?.displayName ?? "").trim();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error("Username must be 3-20 lowercase letters, numbers, or underscores.");
  }
  if (displayName.length < 1 || displayName.length > 20) {
    throw new Error("Display name is required (1-20 characters).");
  }
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  return { username, password, displayName };
}

export const Route = createFileRoute("/api/public/staff")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        try {
          await requireAdmin(request);
          return json({ staff: await listStaff() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load staff";
          return json({ error: message }, message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500);
        }
      },
      POST: async ({ request }) => {
        try {
          await requireAdmin(request);
          const data = validateModeratorInput(await request.json().catch(() => ({})));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const email = `${data.username}@koth.local`;

          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
              username: data.username,
              display_name: data.displayName,
              date_of_birth: "2000-01-01",
            },
          });
          if (error) throw new Error(error.message);
          const newUserId = created.user?.id;
          if (!newUserId) throw new Error("User creation returned no id");

          const { error: roleInsertErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: newUserId, role: "moderator" });
          if (roleInsertErr && !roleInsertErr.message.includes("duplicate")) {
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            throw new Error(roleInsertErr.message);
          }

          return json({ ok: true, userId: newUserId, username: data.username, email }, 201);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create moderator";
          return json({ error: message }, message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400);
        }
      },
      DELETE: async ({ request }) => {
        try {
          const { userId: adminUserId } = await requireAdmin(request);
          const body = await request.json().catch(() => ({}));
          const userId = String(body?.userId ?? "").trim();
          if (!userId) throw new Error("userId required");
          if (userId === adminUserId) throw new Error("You cannot delete your own account.");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
          if ((roles ?? []).some((r: any) => r.role === "admin")) throw new Error("Cannot delete an admin account.");

          const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (delAuthErr) throw new Error(delAuthErr.message);
          return json({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to delete moderator";
          return json({ error: message }, message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400);
        }
      },
    },
  },
});