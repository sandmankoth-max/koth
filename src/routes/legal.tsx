import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  component: () => (
    <div
      className="mx-auto min-h-screen max-w-md bg-background px-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
      }}
    >
      <Link to="/" className="label-broadcast text-muted-foreground">
        ← Back
      </Link>
      <Outlet />
    </div>
  ),
});
