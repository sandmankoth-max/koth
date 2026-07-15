import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { registerDeviceToken } from "@/lib/device-tokens.functions";
import { toast } from "sonner";

/**
 * Registers the native iOS/Android device for FCM push notifications and
 * stores the FCM registration token in `device_tokens` so the `send-push`
 * edge function can deliver pushes that mirror in-app notifications.
 * No-op on the web. FirebaseMessaging is imported dynamically so its
 * optional `firebase/messaging` peer dep never enters the web build.
 */
export function useNativePush() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListeners: Array<() => void> = [];
    let cancelled = false;

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
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled || !sessionData.session) return;

      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

      const perm = await FirebaseMessaging.checkPermissions();
      let status = perm.receive;
      if (status === "prompt" || status === "prompt-with-rationale") {
        status = (await FirebaseMessaging.requestPermissions()).receive;
      }
      if (status !== "granted") return;

      try {
        const { token } = await FirebaseMessaging.getToken();
        if (token) await saveToken(token);
      } catch (e) {
        console.error("[push] getToken failed", e);
      }

      const tokenSub = await FirebaseMessaging.addListener("tokenReceived", (e: { token?: string }) => {
        if (e?.token) void saveToken(e.token);
      });
      const recvSub = await FirebaseMessaging.addListener("notificationReceived", (e: { notification?: { title?: string; body?: string } }) => {
        const n = e?.notification;
        if (n) toast(n.title ?? "Notification", { description: n.body ?? undefined });
      });
      removeListeners = [() => tokenSub.remove(), () => recvSub.remove()];
    }

    setup();
    return () => {
      cancelled = true;
      removeListeners.forEach((fn) => fn());
    };
  }, []);
}
