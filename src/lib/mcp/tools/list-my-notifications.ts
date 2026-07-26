import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_my_notifications",
  title: "List my notifications",
  description: "List the signed-in user's KOTH notifications, newest first.",
  inputSchema: {
    unread_only: z.boolean().optional().describe("Only return unread notifications."),
    limit: z.number().int().min(1).max(50).optional().describe("How many to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only, limit }, ctx) => {
    const unauthorized = requireAuth(ctx);
    if (unauthorized) return unauthorized;

    let query = supabaseForUser(ctx)
      .from("notifications")
      .select("id,type,payload,read,created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);

    if (unread_only) query = query.eq("read", false);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return { ...textResult(data ?? []), structuredContent: { notifications: data ?? [] } };
  },
});
