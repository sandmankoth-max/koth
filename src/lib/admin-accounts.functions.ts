import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createAdminAccount = createServerFn({ method: "POST" })
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
    // Verify caller is admin
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Synthetic email so we don't need real inboxes for staff accounts.
    const email = `${data.username}@admin.koth.local`;

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

    // Grant admin role (handle_new_user already inserts a 'member' row).
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "admin" });
    if (roleInsertErr && !roleInsertErr.message.includes("duplicate")) {
      throw new Error(roleInsertErr.message);
    }

    return { ok: true, userId: newUserId, username: data.username, email };
  });
