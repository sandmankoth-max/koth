import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const NATIVE_ORIGINS = new Set([
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
]);

const corsMiddleware = createMiddleware().server(async ({ next, request }) => {
  const origin = request.headers.get("origin");
  const isAllowedOrigin = origin != null && NATIVE_ORIGINS.has(origin);

  if (request.method === "OPTIONS" && isAllowedOrigin) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, x-tsr-serverfn",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  const result = await next();

  if (isAllowedOrigin) {
    const maybeResponse = (result as any)?.response;
    if (maybeResponse instanceof Response) {
      maybeResponse.headers.set("Access-Control-Allow-Origin", origin);
      maybeResponse.headers.set("Vary", "Origin");
    } else if (result instanceof Response) {
      result.headers.set("Access-Control-Allow-Origin", origin);
      result.headers.set("Vary", "Origin");
    }
  }

  return result;

});

/**
 * Published web origin where the TanStack server functions actually run.
 * The native iOS app is bundled (capacitor:// origin) and has no backend
 * of its own, so every server-fn request must be retargeted to the live
 * site or it 404s ("Server function info not found").
 */
const NATIVE_SERVER_FN_ORIGIN = "https://pixel-perfect-clone-25865.lovable.app";

function isNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;
  // capacitor:// (iOS) and https://localhost (Android) are the two bundled
  // origins Capacitor serves; both lack any backend.
  const proto = window.location.protocol;
  if (proto === "capacitor:" || proto === "ionic:" || proto === "file:") return true;
  // Fall back to the Capacitor global if present.
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

const nativeServerFnFetch: typeof fetch = (input, init) => {
  try {
    if (isNativeRuntime() && typeof input === "string" && input.startsWith("/")) {
      input = NATIVE_SERVER_FN_ORIGIN + input;
    } else if (isNativeRuntime() && input instanceof URL && input.origin !== NATIVE_SERVER_FN_ORIGIN) {
      // Only rewrite same-origin (capacitor://localhost) requests.
      if (input.hostname === "localhost" || input.protocol === "capacitor:") {
        input = NATIVE_SERVER_FN_ORIGIN + input.pathname + input.search;
      }
    }
  } catch {
    /* fall through to default fetch */
  }
  return fetch(input as any, init);
};

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [corsMiddleware, errorMiddleware],
  serverFns: { fetch: nativeServerFnFetch },
}));
