import { registerSW } from "virtual:pwa-register";
import { create } from "zustand";

// Service worker registration, install prompt and update prompt, exposed as a
// tiny store so the UI can offer "Install app" / "Update available".

export const usePwaStore = create(() => ({
  installEvent: null, // the deferred beforeinstallprompt event
  updateReady: false,
}));

let updateSW = null;

export const initPwa = () => {
  if (!("serviceWorker" in navigator)) return;

  updateSW = registerSW({
    onNeedRefresh: () => usePwaStore.setState({ updateReady: true }),
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    usePwaStore.setState({ installEvent: event });
  });
  window.addEventListener("appinstalled", () => usePwaStore.setState({ installEvent: null }));
};

export const promptInstall = async () => {
  const event = usePwaStore.getState().installEvent;
  if (!event) return;
  event.prompt();
  await event.userChoice.catch(() => {});
  usePwaStore.setState({ installEvent: null });
};

export const applyUpdate = () => updateSW?.(true);
