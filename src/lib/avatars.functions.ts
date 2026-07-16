import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Sign a URL for any user's avatar path. Runs with the service role so it
 * works regardless of the caller's per-folder storage policy, but requires
 * an authenticated session — avatars are only visible inside the app.
 */
export const signAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      path: z.string().min(1).max(512),
      expiresIn: z.number().int().positive().max(24 * 3600).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("koth-avatars")
      .createSignedUrl(data.path, data.expiresIn ?? 3600);
    if (error) throw new Error(error.message);
    return { signedUrl: signed?.signedUrl ?? null };
  });
