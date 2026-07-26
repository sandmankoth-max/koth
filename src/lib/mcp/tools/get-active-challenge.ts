import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "get_active_challenge",
  title: "Get the current challenge",
  description: "Get the currently open KOTH weekly challenge, including title, unit, prizes, and end time.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const unauthorized = requireAuth(ctx);
    if (unauthorized) return unauthorized;

    const { data, error } = await supabaseForUser(ctx)
      .from("challenges")
      .select(
        "id,title,description,unit_label,unit_type,status,starts_at,ends_at,prize_first,prize_second,prize_third,max_video_seconds",
      )
      .eq("status", "open")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return errorResult(error.message);
    if (!data) return textResult({ challenge: null, note: "No challenge is currently open." });
    return { ...textResult(data), structuredContent: { challenge: data } };
  },
});
