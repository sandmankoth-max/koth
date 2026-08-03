import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Public invite landing page: /add/<username>
 *
 * On iOS this path is claimed by the app as a Universal Link, so tapping the
 * link opens KOTH directly and never shows this page. If the app is not
 * installed (or the link is opened on desktop), this page loads and forwards
 * into the web profile with the auto-add flag.
 */
export const Route = createFileRoute("/add/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `Add @${params.username} on KOTH` },
      { name: "description", content: `Open KOTH to instantly add @${params.username} as a friend and compete in weekly challenges.` },
      { property: "og:title", content: `Add @${params.username} on KOTH` },
      { property: "og:description", content: `Open KOTH to instantly add @${params.username} as a friend.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddFriendLanding,
});

function AddFriendLanding() {
  const { username } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      navigate({ to: "/u/$username", params: { username }, search: { add: "1" } as never });
    }, 600);
    return () => clearTimeout(t);
  }, [username, navigate]);

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-bold text-foreground">Adding @{username} on KOTH</h1>
      <p className="text-sm text-muted-foreground">
        Opening the app. If nothing happens, install KOTH and tap the link again.
      </p>
    </main>
  );
}
