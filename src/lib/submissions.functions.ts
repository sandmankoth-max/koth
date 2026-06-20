import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const chunk = <T>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

async function removeVideoPaths(supabaseAdmin: SupabaseClient<Database>, paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return 0;

  for (const batch of chunk(uniquePaths, 500)) {
    const { error } = await supabaseAdmin.storage.from("koth-videos").remove(batch);
    if (error) throw new Error(error.message);
  }
  return uniquePaths.length;
}

export const deleteOwnSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ submissionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: submission, error: fetchError } = await context.supabase
      .from("submissions")
      .select("id, user_id, video_path")
      .eq("id", data.submissionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!submission) throw new Error("Submission not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await removeVideoPaths(supabaseAdmin, [submission.video_path]);

    const { error: deleteError } = await context.supabase
      .from("submissions")
      .delete()
      .eq("id", submission.id)
      .eq("user_id", context.userId);
    if (deleteError) throw new Error(deleteError.message);

    return { deleted: true };
  });

export const deletePreviousSubmissionsForChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        challengeId: z.string().uuid(),
        keepSubmissionId: z.string().uuid(),
        // When omitted we default to "public" for back-compat.
        visibility: z.enum(["public", "friends_only"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Always purge any prior SUSPENDED attempts for this user/challenge —
    // they should not linger anywhere once the user reattempts.
    const { data: suspended, error: suspErr } = await context.supabase
      .from("submissions")
      .select("id, video_path")
      .eq("user_id", context.userId)
      .eq("challenge_id", data.challengeId)
      .eq("status", "disqualified")
      .neq("id", data.keepSubmissionId);
    if (suspErr) throw new Error(suspErr.message);

    let toDelete = suspended ?? [];

    if (data.visibility !== "friends_only") {
      // Public uploads also replace earlier non-suspended public attempts.
      const { data: pubs, error: pubErr } = await context.supabase
        .from("submissions")
        .select("id, video_path")
        .eq("user_id", context.userId)
        .eq("challenge_id", data.challengeId)
        .eq("visibility", "public")
        .neq("status", "disqualified")
        .neq("id", data.keepSubmissionId);
      if (pubErr) throw new Error(pubErr.message);
      toDelete = [...toDelete, ...(pubs ?? [])];
    }

    if (toDelete.length === 0) return { deleted: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await removeVideoPaths(supabaseAdmin, toDelete.map((s) => s.video_path));

    const ids = toDelete.map((s) => s.id);
    const { error: deleteError } = await context.supabase
      .from("submissions")
      .delete()
      .in("id", ids);
    if (deleteError) throw new Error(deleteError.message);

    return { deleted: toDelete.length };
  });

export const cleanupOldChallengeSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ keepChallengeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Keep each user's final/active PUBLIC submission per past challenge plus
    // every friends-only submission (those live on the user's profile forever).
    // Only purge intermediate public takes.
    const { data: submissions, error: fetchError } = await context.supabase
      .from("submissions")
      .select("id, video_path")
      .neq("challenge_id", data.keepChallengeId)
      .eq("is_active_entry", false)
      .eq("visibility", "public");
    if (fetchError) throw new Error(fetchError.message);

    const oldSubmissions = submissions ?? [];
    await removeVideoPaths(
      supabaseAdmin,
      oldSubmissions.map((submission) => submission.video_path),
    );

    if (oldSubmissions.length > 0) {
      const ids = oldSubmissions.map((s) => s.id);
      const { error: deleteError } = await context.supabase
        .from("submissions")
        .delete()
        .in("id", ids);
      if (deleteError) throw new Error(deleteError.message);
    }

    return { deleted: oldSubmissions.length };
  });
