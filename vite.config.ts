// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The prerendered index.html includes SSR streaming markers (<!--$-->),
// a $_TSR hydration payload, and inline scroll-restoration/toaster nodes.
// In a Capacitor bundle there is no server to complete the stream, so
// hydration wedges on the barrier and the WKWebView shows a grey screen.
// Rewrite the file into a bare SPA shell: keep <head> (title, meta,
// stylesheets, modulepreloads) and reduce <body> to just the client
// entry <script>. TanStack Router's client entry mounts a fresh render
// into the empty document, which is exactly what a static Capacitor
// build needs. Only affects dist/client / .output/public static files;
// the Cloudflare Worker keeps rendering pages through its SSR entry.
function capacitorSpaShell() {
  let scheduled = false;
  const rewrite = () => {
    const targets = [
      resolve(process.cwd(), "dist/client/index.html"),
      resolve(process.cwd(), ".output/public/index.html"),
    ];
    for (const file of targets) {
      if (!existsSync(file)) continue;
      const html = readFileSync(file, "utf8");
      // Already rewritten: no SSR fences present.
      if (!html.includes("<!--$-->") && !html.includes("$_TSR")) continue;
      const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (!headMatch || !bodyMatch) continue;
      const scripts = Array.from(
        bodyMatch[1].matchAll(
          /<script\b[^>]*type="module"[^>]*src="\/assets\/[^"]+"[^>]*>\s*<\/script>/g,
        ),
      ).map((m) => m[0]);
      if (scripts.length === 0) continue;
      const htmlTagMatch = html.match(/<html[^>]*>/i);
      const htmlOpen = htmlTagMatch ? htmlTagMatch[0] : '<html lang="en">';
      const shell =
        `<!DOCTYPE html>${htmlOpen}<head>${headMatch[1]}</head>` +
        `<body>${scripts.join("")}</body></html>`;
      writeFileSync(file, shell);
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    // Nitro's prerender runs asynchronously after Vite's closeBundle.
    // beforeExit fires once the event loop drains, after prerender writes
    // its final index.html, so the rewrite always sees the fresh file.
    process.on("beforeExit", rewrite);
  };
  return {
    name: "koth:capacitor-spa-shell",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        rewrite();
        schedule();
      },
    },
  };
}

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
    plugins: [nitroPreviewEntryShim(), mirrorSpaToDistClient(), capacitorSpaShell()],
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
