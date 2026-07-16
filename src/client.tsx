import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Await, RouterProvider } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";

import { getRouter } from "./router";
import { startInstance } from "./start";

import type { AnyRouter } from "@tanstack/react-router";

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
    __TSS_START_OPTIONS__?: unknown;
  }
}

let nativeRouterPromise: Promise<AnyRouter> | undefined;

function isNativeRuntime(): boolean {
  const protocol = window.location.protocol;
  if (protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:") return true;
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

async function getNativeRouter(): Promise<AnyRouter> {
  const router = await getRouter();
  const startOptions = await startInstance.getOptions();
  startOptions.serializationAdapters = startOptions.serializationAdapters ?? [];
  window.__TSS_START_OPTIONS__ = startOptions;

  router.options.defaultSsr = startOptions.defaultSsr;
  router.update({
    serializationAdapters: [
      ...startOptions.serializationAdapters,
      ...(router.options.serializationAdapters ?? []),
    ],
  });

  return router;
}

function NativeStartClient() {
  nativeRouterPromise ??= getNativeRouter();
  return <Await promise={nativeRouterPromise} children={(router) => <RouterProvider router={router} />} />;
}

startTransition(() => {
  if (isNativeRuntime()) {
    createRoot(document).render(
      <StrictMode>
        <NativeStartClient />
      </StrictMode>,
    );
    return;
  }

  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});