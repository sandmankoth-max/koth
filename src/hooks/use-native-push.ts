import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { registerDeviceToken } from "@/lib/device-tokens.functions";
import { toast } from "sonner";

/**
 * Registers the native iOS/Android device for FCM push notifications.
 * Fully lazy + defensive: any failure is swallowed so the app UI is
 * never affected by push init problems. No-op on web.
 */
export function useNativePush() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListeners: Array<() => void> = [];
    let cancelled = false;
    let didSetup = false;

    async function saveToken(token: string) {
      try {
        await registerDeviceToken({
          data: { token, platform: Capacitor.getPlatform() as "ios" | "android" },
        });
      } catch (e) {
        console.error("[push] failed to register token", e);
      }
    }

    async function setup() {
      if (didSetup || cancelled) return;
      try {
        console.log("[push] setup() starting");
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled || !sessionData.session) {
          console.log("[push] no session, aborting", {
            cancelled,
            hasSession: !!sessionData.session,
          });
          return;
        }
        console.log("[push] session found, proceeding");
        didSetup = true;

        let FirebaseMessaging: typeof import("@capacitor-firebase/messaging").FirebaseMessaging;
        try {
          const mod = await import("@capacitor-firebase/messaging");
          FirebaseMessaging = mod.FirebaseMessaging;
          console.log("[push] FirebaseMessaging imported");
        } catch (e) {
          console.error("[push] failed to import FirebaseMessaging", e);
          return;
        }

        let status: string;
        try {
          const perm = await FirebaseMessaging.checkPermissions();
          status = perm.receive;
          console.log("[push] permission status:", status);
        } catch (e) {
          console.error("[push] checkPermissions error:", e);
          return;
        }

        if (status === "prompt" || status === "prompt-with-rationale") {
          try {
            status = (await FirebaseMessaging.requestPermissions()).receive;
            console.log("[push] permission after request:", status);
          } catch (e) {
            console.error("[push] requestPermissions error:", e);
            return;
          }
        }

        if (status !== "granted") {
          console.log("[push] permission not granted, aborting:", status);
          return;
        }

        try {
          const { token } = await FirebaseMessaging.getToken();
          console.log("[push] got token:", token ? `${token.slice(0, 12)}…` : "(empty)");
          if (token) await saveToken(token);
        } catch (e) {
          console.log("[push] getToken error:", e);
          console.error("[push] getToken failed", e);
        }

        try {
          const tokenSub = await FirebaseMessaging.addListener(
            "tokenReceived",
            (e: { token?: string }) => {
              if (e?.token) void saveToken(e.token);
            },
          );
          const recvSub = await FirebaseMessaging.addListener(
            "notificationReceived",
            (e: { notification?: { title?: string; body?: string } }) => {
              const n = e?.notification;
              if (n) toast(n.title ?? "Notification", { description: n.body ?? undefined });
            },
          );
          removeListeners = [() => tokenSub.remove(), () => recvSub.remove()];
          console.log("[push] setup complete, listeners attached");
        } catch (e) {
          console.error("[push] addListener error:", e);
        }
      } catch (e) {
        console.error("[push] setup() unexpected error:", e);
      }
    }

    // Kick off initial attempt (may no-op if not signed in yet)
    void setup();

    // Also retry on SIGNED_IN so users who log in after mount get registered
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        console.log("[push] SIGNED_IN event, running setup()");
        void setup();
      }
    });

    return () => {
      cancelled = true;
      try {
        authSub.subscription.unsubscribe();
      } catch {}
      removeListeners.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, []);
}
