import "@/lib/fonts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { useNativePush } from "@/hooks/use-native-push";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="mono-stat text-7xl font-bold text-koth-red">404</h1>
        <h2 className="mt-4 text-xl font-bold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This corner of the arena doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="tap-44 inline-flex items-center justify-center rounded-full bg-koth-red px-5 py-2 text-sm font-bold text-koth-white"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-foreground">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tap-44 inline-flex items-center justify-center rounded-full bg-koth-red px-5 py-2 text-sm font-bold text-koth-white"
          >
            Try again
          </button>
          <a
            href="/"
            className="tap-44 inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-bold text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#0D0D0D" },
      { title: "KOTH — King of the Hill" },
      {
        name: "description",
        content:
          "KOTH is a weekly skill-challenge competition. Record your attempt, climb the leaderboard, win cash.",
      },
      { property: "og:title", content: "KOTH — King of the Hill" },
      { property: "og:description", content: "Pixel Perfect builds applications from screenshots, replicating designs precisely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "KOTH — King of the Hill" },
      { name: "description", content: "Pixel Perfect builds applications from screenshots, replicating designs precisely." },
      { name: "twitter:description", content: "Pixel Perfect builds applications from screenshots, replicating designs precisely." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5e808f0e-13ab-49db-a0ac-d9bdc6a4d86c/id-preview-63d9bcb7--c9bd69d3-6c49-4f3b-98ac-1695c2d8c121.lovable.app-1781981021727.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5e808f0e-13ab-49db-a0ac-d9bdc6a4d86c/id-preview-63d9bcb7--c9bd69d3-6c49-4f3b-98ac-1695c2d8c121.lovable.app-1781981021727.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthRefetcher() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);
  return null;
}

function NativePushBridge() {
  useNativePush();
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthRefetcher />
        <NativePushBridge />
        <Outlet />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
