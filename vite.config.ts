// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// TanStack Start's SPA prerender boots a Node preview server that loads
// `dist/server/<entry>.js`. Our nitro target is Cloudflare, which emits an
// `index.mjs` whose `augmentReq` mutates `req.ip` and reads `env.ASSETS` —
// both Node-incompatible. The raw, un-wrapped SSR build lives at
// `node_modules/.nitro/vite/services/ssr/index.js` and works in Node, so we
// write a tiny `dist/server/server.js` that re-exports it via an absolute
// file:// URL. We intentionally do NOT copy the raw SSR assets into
// `dist/server/assets/` — doing so clobbers Cloudflare's worker chunks
// (e.g. `assets/react.js`) and breaks the deployed site.
function nitroPreviewEntryShim() {
  return {
    name: "koth:nitro-preview-entry-shim",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        const cwd = process.cwd();
        const rawEntry = resolve(cwd, "node_modules/.nitro/vite/services/ssr/index.js");
        if (!existsSync(rawEntry)) return;
        const distServer = resolve(cwd, "dist/server");
        // Create dist/server if missing — a clean build has no leftover folder,
        // and without this the prerender step crashes with ERR_MODULE_NOT_FOUND
        // and .output/public/index.html is never generated.
        if (!existsSync(distServer)) {
          mkdirSync(distServer, { recursive: true });
        }
        const serverShim = resolve(distServer, "server.js");
        if (existsSync(serverShim)) return;
        const rawUrl = pathToFileURL(rawEntry).href;
        writeFileSync(serverShim, `export { default } from ${JSON.stringify(rawUrl)};\n`);
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
    plugins: [mcpPlugin(), nitroPreviewEntryShim()],
  },
});
