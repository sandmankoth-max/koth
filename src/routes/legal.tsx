import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  component: () => (
    <div className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <Link to="/" className="label-broadcast text-muted-foreground">
        ← Back
      </Link>
      <Outlet />
    </div>
  ),
});
