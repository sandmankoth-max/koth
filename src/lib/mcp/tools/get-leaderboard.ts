import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "get_leaderboard",
  title: "Get the leaderboard",
  description:
    "Get the ranked leaderboard for a KOTH challenge (defaults to the currently open challenge).",
  inputSchema: {
    challenge_id: z.string().uuid().optional().describe("Challenge id. Defaults to the open challenge."),
    limit: z.number().int().min(1).max(50).optional().describe("How many entries to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ challenge_id, limit }, ctx) => {
    const unauthorized = requireAuth(ctx);
    if (unauthorized) return unauthorized;

    const supabase = supabaseForUser(ctx);

    let challengeId = challenge_id;
    if (!challengeId) {
      const { data: challenge, error: challengeError } = await supabase
        .from("challenges")
        .select("id")
        .eq("status", "open")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (challengeError) return errorResult(challengeError.message);
      if (!challenge) return textResult({ entries: [], note: "No challenge is currently open." });
      challengeId = challenge.id;
    }

    const { data, error } = await supabase
      .from("submissions")
      .select("id,user_id,self_reported_value,admin_verified_value,status,submitted_at")
      .eq("challenge_id", challengeId)
      .eq("status", "approved")
      .eq("is_active_entry", true)
      .order("admin_verified_value", { ascending: false, nullsFirst: false })
      .limit(limit ?? 10);

    if (error) return errorResult(error.message);

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id,username,display_name").in("id", userIds)
      : { data: [] as { id: string; username: string; display_name: string }[] };

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const entries = rows.map((row, index) => ({
      rank: index + 1,
      username: byId.get(row.user_id)?.username ?? null,
      display_name: byId.get(row.user_id)?.display_name ?? null,
      value: row.admin_verified_value ?? row.self_reported_value,
      submitted_at: row.submitted_at,
    }));

    return { ...textResult({ challenge_id: challengeId, entries }), structuredContent: { entries } };
  },
});
