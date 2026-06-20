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

    const { error: deleteError } = await supabaseAdmin
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
    z.object({ challengeId: z.string().uuid(), keepSubmissionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: submissions, error: fetchError } = await context.supabase
      .from("submissions")
      .select("id, video_path")
      .eq("user_id", context.userId)
      .eq("challenge_id", data.challengeId)
      .neq("id", data.keepSubmissionId);
    if (fetchError) throw new Error(fetchError.message);

    const oldSubmissions = submissions ?? [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await removeVideoPaths(
      supabaseAdmin,
      oldSubmissions.map((submission) => submission.video_path),
    );

    if (oldSubmissions.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("submissions")
        .delete()
        .eq("user_id", context.userId)
        .eq("challenge_id", data.challengeId)
        .neq("id", data.keepSubmissionId);
      if (deleteError) throw new Error(deleteError.message);
    }

    return { deleted: oldSubmissions.length };
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
    const { data: submissions, error: fetchError } = await supabaseAdmin
      .from("submissions")
      .select("id, video_path")
      .neq("challenge_id", data.keepChallengeId);
    if (fetchError) throw new Error(fetchError.message);

    const oldSubmissions = submissions ?? [];
    await removeVideoPaths(
      supabaseAdmin,
      oldSubmissions.map((submission) => submission.video_path),
    );

    if (oldSubmissions.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("submissions")
        .delete()
        .neq("challenge_id", data.keepChallengeId);
      if (deleteError) throw new Error(deleteError.message);
    }

    return { deleted: oldSubmissions.length };
  });