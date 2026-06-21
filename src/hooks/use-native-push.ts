import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { registerDeviceToken } from "@/lib/device-tokens.functions";
import { toast } from "sonner";

/**
 * Registers the native iOS/Android device for push notifications and stores
 * the APNs/FCM token in `device_tokens` so a sender service (FCM) can deliver
 * pushes that mirror in-app notifications. No-op on the web.
 */
export function useNativePush() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListeners: Array<() => void> = [];
    let cancelled = false;

    async function setup() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled || !sessionData.session) return;

      const perm = await PushNotifications.checkPermissions();
      let status = perm.receive;
      if (status === "prompt" || status === "prompt-with-rationale") {
        status = (await PushNotifications.requestPermissions()).receive;
      }
      if (status !== "granted") return;

      await PushNotifications.register();

      const regSub = await PushNotifications.addListener("registration", async (t) => {
        try {
          await registerDeviceToken({
            data: { token: t.value, platform: Capacitor.getPlatform() as "ios" | "android" },
          });
        } catch (e) {
          console.error("[push] failed to register token", e);
        }
      });
      const errSub = await PushNotifications.addListener("registrationError", (e) => {
        console.error("[push] registration error", e);
      });
      const recvSub = await PushNotifications.addListener("pushNotificationReceived", (n) => {
        // Foreground notification — surface as toast
        toast(n.title ?? "Notification", { description: n.body });
      });
      removeListeners = [
        () => regSub.remove(),
        () => errSub.remove(),
        () => recvSub.remove(),
      ];
    }

    setup();
    return () => {
      cancelled = true;
      removeListeners.forEach((fn) => fn());
    };
  }, []);
}
