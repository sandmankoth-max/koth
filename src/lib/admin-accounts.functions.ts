import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createModeratorAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { username: string; password: string; displayName?: string }) => {
    const username = String(data.username ?? "").trim().toLowerCase();
    const password = String(data.password ?? "");
    const displayName = data.displayName ? String(data.displayName).trim() : username;
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3-20 lowercase letters, numbers, or underscores.");
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

    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role, user_id, profiles!user_roles_user_id_fkey(username, display_name)")
      .in("role", ["admin", "moderator"]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role as "admin" | "moderator",
      username: r.profiles?.username ?? "(unknown)",
      display_name: r.profiles?.display_name ?? null,
    }));
  });
