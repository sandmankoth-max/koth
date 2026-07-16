// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Capacitor (iOS) is configured with `webDir: '.output/public'` in
// capacitor.config.ts, but historically it pointed at `dist/client`. To keep
// both paths working (and to guarantee dev machines with an older
// capacitor.config never load stale bundles), mirror the freshly-built SPA
// output from `.output/public` into `dist/client` after each production build.
function mirrorSpaToDistClient() {
  return {
    name: "koth:mirror-spa-to-dist-client",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        const cwd = process.cwd();
        const src = resolve(cwd, ".output/public");
        const dest = resolve(cwd, "dist/client");
        if (!existsSync(src)) return;
        if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
        cpSync(src, dest, { recursive: true });
      },
    },
  };
}


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
        const distServer = resolve(cwd, "dist/server");
        if (!existsSync(rawEntry) || !existsSync(distServer)) return;
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
    plugins: [nitroPreviewEntryShim()],
    resolve: {
      // Lovable's config stubs optional peer deps; force firebase/messaging
      // to resolve to the real package so @capacitor-firebase/messaging's
      // web wrapper can import `isSupported` from it.
      alias: [
        {
          find: /^firebase\/messaging$/,
          replacement: resolve(process.cwd(), "node_modules/firebase/messaging/dist/esm/index.esm.js"),
        },
      ],
    },
    optimizeDeps: {
      include: ["firebase/messaging"],
    },
  },
});
