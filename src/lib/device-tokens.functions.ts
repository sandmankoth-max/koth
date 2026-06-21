import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RegisterSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(["ios", "android", "web"]),
});

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RegisterSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_tokens")
      .upsert(
        {
          user_id: context.userId,
          token: data.token,
          platform: data.platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const removeDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
