import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createModeratorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { username: string; password: string; displayName: string }) => {
    const username = String(data.username ?? "").trim().toLowerCase();
    const password = String(data.password ?? "");
    const displayName = String(data.displayName ?? "").trim();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3-20 lowercase letters, numbers, or underscores.");
    if (displayName.length < 1 || displayName.length > 20) throw new Error("Display name is required (1-20 characters).");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    return { username, password, displayName };
  })
  .handler(async ({ data, context }) => {
    // Only the admin can create moderators.
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden — only the admin can create moderator accounts.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `${data.username}@mod.koth.local`;

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
      throw new Error(roleInsertErr.message);
    }

    return { ok: true, userId: newUserId, username: data.username, email };
  });

export const listStaffAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("role, user_id")
      .in("role", ["admin", "moderator"]);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [] as Array<{ user_id: string; role: "admin" | "moderator"; username: string; display_name: string | null }>;
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
  });

export const deleteModeratorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    const userId = String(data.userId ?? "").trim();
    if (!userId) throw new Error("userId required");
    return { userId };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden — only the admin can delete moderator accounts.");
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Refuse to delete admins
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((roles ?? []).some((r: any) => r.role === "admin")) {
      throw new Error("Cannot delete an admin account.");
    }

    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delAuthErr) throw new Error(delAuthErr.message);
    return { ok: true };
  });
