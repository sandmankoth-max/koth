import { type ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col bg-background"
      style={{ height: "100dvh", minHeight: "100dvh" }}
    >
      <TopBar />
      <main
        className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pt-4"
        style={{
          WebkitOverflowScrolling: "touch",
          paddingBottom: "calc(7rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
