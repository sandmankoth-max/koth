import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the calling user's account. Removes auth row (which
 * cascades to profile/submissions/friendships/notifications via FK ON DELETE
 * CASCADE) and best-effort cleans up their videos + avatar from storage.
 *
 * Every cleanup step is wrapped so a single non-critical failure (e.g. a
 * moderator who has no submissions or no avatar folder) can't abort the
 * whole deletion.
 */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Best-effort: collect this user's video paths so storage doesn't leak.
    try {
      const { data: subs } = await supabaseAdmin
        .from("submissions")
        .select("video_path")
        .eq("user_id", userId);
      const paths = (subs ?? []).map((s: any) => s.video_path).filter(Boolean);
      if (paths.length > 0) {
        await supabaseAdmin.storage.from("koth-videos").remove(paths);
      }
    } catch (e) {
      console.error("deleteOwnAccount: video cleanup failed", e);
    }

    // Best-effort: remove avatar folder contents.
    try {
      const { data: avatars } = await supabaseAdmin.storage
        .from("koth-avatars")
        .list(userId);
      if (avatars && avatars.length > 0) {
        await supabaseAdmin.storage
          .from("koth-avatars")
          .remove(avatars.map((f) => `${userId}/${f.name}`));
      }
    } catch (e) {
      console.error("deleteOwnAccount: avatar cleanup failed", e);
    }

    // Best-effort: pre-clear role rows so any non-cascading FK can't block
    // the auth deletion (mod/admin accounts have rows here).
    try {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    } catch (e) {
      console.error("deleteOwnAccount: role cleanup failed", e);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });
