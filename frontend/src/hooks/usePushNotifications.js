import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../api/client";

// Web Push on this device: whether it's possible, whether it's on, and the
// switch. Notifications arrive via the service worker (src/sw.js) when
// Talkify isn't open.

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const deviceSupportsPush = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const currentSubscription = async () => {
  if (!deviceSupportsPush()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
};

/** Removes this device's subscription. Called on logout too. */
export const unsubscribeThisDevice = async () => {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await apiClient.post("/api/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    // Best effort.
  }
};

const usePushNotifications = () => {
  const [state, setState] = useState({ loading: true, available: false, subscribed: false, reason: null });

  const refresh = useCallback(async () => {
    if (!deviceSupportsPush()) {
      setState({
        loading: false,
        available: false,
        subscribed: false,
        reason:
          "This browser doesn’t support notifications. On iPhone, add Talkify to your Home Screen first.",
      });
      return;
    }
    try {
      const config = await apiClient.get("/api/push/config");
      if (!config.enabled) {
        setState({
          loading: false,
          available: false,
          subscribed: false,
          reason: "Notifications aren’t set up on this server yet.",
        });
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setState({
          loading: false,
          available: false,
          subscribed: false,
          reason: "Notifications need the installed app (or a production build).",
        });
        return;
      }
      const subscription = await registration.pushManager.getSubscription();
      const denied = Notification.permission === "denied";
      setState({
        loading: false,
        available: !denied,
        subscribed: !!subscription && !denied,
        publicKey: config.publicKey,
        reason: denied ? "Notifications are blocked for this site in your browser settings." : null,
      });
    } catch {
      setState({
        loading: false,
        available: false,
        subscribed: false,
        reason: "Couldn’t check notification settings.",
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await refresh();
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(state.publicKey),
        }));
      await apiClient.post("/api/push/subscribe", { subscription: subscription.toJSON() });
      await refresh();
      return true;
    } catch {
      await refresh();
      return false;
    }
  }, [refresh, state.publicKey]);

  const disable = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    await unsubscribeThisDevice();
    await refresh();
  }, [refresh]);

  return { ...state, enable, disable };
};

export default usePushNotifications;
