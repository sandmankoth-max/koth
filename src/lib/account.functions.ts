import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the calling user's account. Removes auth row (which
 * cascades to profile/submissions/friendships/notifications via FK ON DELETE
 * CASCADE) and best-effort cleans up their videos + avatar from storage.
 */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort: collect this user's video paths so storage doesn't leak.
    const { data: subs } = await context.supabase
      .from("submissions")
      .select("video_path")
      .eq("user_id", context.userId);
    const paths = (subs ?? []).map((s: any) => s.video_path).filter(Boolean);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from("koth-videos").remove(paths);
    }

    // Best-effort: remove avatar folder contents.
    const { data: avatars } = await supabaseAdmin.storage
      .from("koth-avatars")
      .list(context.userId);
    if (avatars && avatars.length > 0) {
      await supabaseAdmin.storage
        .from("koth-avatars")
        .remove(avatars.map((f) => `${context.userId}/${f.name}`));
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });
