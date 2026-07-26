import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_my_submissions",
  title: "List my submissions",
  description: "List the signed-in user's KOTH video submissions with score, status, and visibility.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("How many submissions to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const unauthorized = requireAuth(ctx);
    if (unauthorized) return unauthorized;

    const { data, error } = await supabaseForUser(ctx)
      .from("submissions")
      .select(
        "id,challenge_id,self_reported_value,admin_verified_value,status,visibility,is_active_entry,like_count,comment_count,submitted_at",
      )
      .eq("user_id", ctx.getUserId()!)
      .order("submitted_at", { ascending: false })
      .limit(limit ?? 20);

    if (error) return errorResult(error.message);
    return { ...textResult(data ?? []), structuredContent: { submissions: data ?? [] } };
  },
});
