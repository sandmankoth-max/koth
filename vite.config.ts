// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Bridges the TanStack Start preview-server-plugin (which looks for
// `dist/server/server.js`) to Nitro's actual Cloudflare output
// (`dist/server/index.mjs`) so SPA prerender succeeds during build.
function nitroPreviewEntryShim() {
  return {
    name: "koth:nitro-preview-entry-shim",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        const distServer = resolve(process.cwd(), "dist/server");
        const target = resolve(distServer, "server.js");
        const source = resolve(distServer, "index.mjs");
        if (existsSync(source) && !existsSync(target)) {
          // The Cloudflare nitro entry mutates `req.ip` and reads `env.ASSETS`,
          // both of which break under the Node-based preview server used during
          // SPA prerender. Wrap the call so prerender succeeds in Node.
          writeFileSync(
            target,
            `import original from "./index.mjs";

const fakeEnv = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } };
const fakeCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

export default {
  async fetch(req, env, ctx) {
    const proxied = new Proxy(req, {
      set(target, prop, value) {
        try { target[prop] = value; } catch { /* read-only getter on Node Request */ }
        return true;
      },
    });
    return original.fetch(proxied, env ?? fakeEnv, ctx ?? fakeCtx);
  },
};
`,
          );
        }
      },
    },
  };
}

export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "index.html",
      },
    },
  },
  vite: {
    plugins: [nitroPreviewEntryShim()],
  },
});
