import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KOTH — King of the Hill" },
      {
        name: "description",
        content: "Weekly skill challenges. Record your attempt. Top 3 win cash.",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-koth-black">
        <div className="mono-stat text-koth-white/60">Loading…</div>
      </div>
    );
  }
  if (session) return <Navigate to="/home" />;

  return (
    <div className="relative flex min-h-screen flex-col bg-koth-black px-6 text-koth-white">
      {/* Diagonal red broadcast accent across the corner */}
      <div className="koth-stripe absolute inset-x-0 top-0 h-40 pointer-events-none" />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="koth-stripe flex h-24 w-24 items-center justify-center rounded-3xl bg-koth-red">
          <span className="mono-stat text-4xl font-bold">K</span>
        </div>
        <div>
          <h1 className="label-broadcast text-3xl tracking-[0.18em] text-koth-white">KOTH</h1>
          <p className="mt-1 label-broadcast text-koth-red tracking-[0.3em]">King of the Hill</p>
        </div>
        <p className="max-w-xs text-balance text-base text-koth-white/80">
          A new physical challenge drops every Monday at 10am. Record your attempt. Climb the leaderboard. Top
          3 win cash by Sunday 8pm.
        </p>
      </div>

      <div className="flex flex-col gap-3 pb-10">
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="tap-44 inline-flex h-12 items-center justify-center rounded-full bg-koth-red text-base font-bold text-koth-white"
        >
          Create account
        </Link>
        <Link
          to="/auth"
          search={{ mode: "login" }}
          className="tap-44 inline-flex h-12 items-center justify-center rounded-full border border-koth-white/20 text-base font-bold text-koth-white"
        >
          Log in
        </Link>
        <p className="text-center text-xs text-koth-white/50">
          By continuing you agree to our{" "}
          <Link to="/legal/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/legal/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
