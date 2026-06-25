import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { SplashAnimation } from "@/components/koth/splash-animation";
import { SplashLaunch } from "@/components/koth/splash-launch";

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
  const [showLaunch, setShowLaunch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const played = sessionStorage.getItem("koth-splash-played");
    if (!played) setShowLaunch(true);
  }, []);

  const handleSplashDone = () => {
    sessionStorage.setItem("koth-splash-played", "1");
    setShowLaunch(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-koth-black">
        <div className="mono-stat text-koth-white/60">Loading…</div>
      </div>
    );
  }
  if (session && !showLaunch) return <Navigate to="/home" />;

  return (
    <>
      {showLaunch && <SplashLaunch onDone={handleSplashDone} />}
    <div
      className="relative flex min-h-screen flex-col bg-koth-black px-6 text-koth-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <SplashAnimation />

        <h1 className="label-broadcast text-center text-2xl tracking-[0.18em] text-koth-white sm:text-3xl">
          King<span className="text-koth-red">.</span> Of
          <span className="text-koth-red">.</span> The
          <span className="text-koth-red">.</span> Hill
          <span className="text-koth-red">.</span>
        </h1>
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
