import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "get_my_profile",
  title: "Get my KOTH profile",
  description: "Get the signed-in user's KOTH profile: username, display name, bio, and account status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const unauthorized = requireAuth(ctx);
    if (unauthorized) return unauthorized;

    const { data, error } = await supabaseForUser(ctx).rpc("get_my_profile");
    if (error) return errorResult(error.message);
    return textResult(Array.isArray(data) ? (data[0] ?? null) : data);
  },
});
