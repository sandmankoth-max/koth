import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const STORAGE_PREFIX = "koth:welcome-seen:";

/**
 * One-time welcome popup shown on first home-page visit per user.
 * Contains the rules / explanation that used to live on the splash page.
 */
export function WelcomeDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = STORAGE_PREFIX + user.id;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(key)) setOpen(true);
  }, [user]);

  function close() {
    if (user && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_PREFIX + user.id, "1");
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to KOTH</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Challenges usually drop Monday at 10am and close Sunday at 5pm —
            timing can shift per challenge. Record your attempt, climb the
            leaderboard, and the top 3 win cash.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-2 text-sm text-foreground">
          <li>• One active entry per challenge — your best attempt counts.</li>
          <li>• Self-report your score; admins verify the leaderboard.</li>
          <li>• If you're on the podium and someone takes your spot, you'll get notified.</li>
        </ul>
        <DialogFooter className="mt-4">
          <Button onClick={close} className="w-full rounded-full">
            Let's go
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
