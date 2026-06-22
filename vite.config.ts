// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// TanStack Start's SPA prerender boots a Node-based preview server that loads
// `dist/server/<entry>.js`. Our nitro target is Cloudflare, which produces
// `dist/server/index.mjs` whose `augmentReq` mutates `req.ip` and reads
// `env.ASSETS` — both incompatible with Node. The raw, un-wrapped SSR build
// lives at `node_modules/.nitro/vite/services/ssr/` and works fine in Node,
// so we copy that into `dist/server/` as `server.js` for the preview/prerender.
function nitroPreviewEntryShim() {
  return {
    name: "koth:nitro-preview-entry-shim",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        const cwd = process.cwd();
        const rawSsrDir = resolve(cwd, "node_modules/.nitro/vite/services/ssr");
        const rawEntry = resolve(rawSsrDir, "index.js");
        const distServer = resolve(cwd, "dist/server");
        if (!existsSync(rawEntry) || !existsSync(distServer)) return;
        const target = resolve(distServer, "server.js");
        if (existsSync(target)) return;
        cpSync(rawEntry, target);
        const rawAssets = resolve(rawSsrDir, "assets");
        const distAssets = resolve(distServer, "assets");
        if (existsSync(rawAssets) && !existsSync(distAssets)) {
          mkdirSync(distAssets, { recursive: true });
          cpSync(rawAssets, distAssets, { recursive: true });
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
