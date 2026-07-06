"use client";

import { useEffect } from "react";
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event) => {
      if (!event.defaultPrevented) event.preventDefault();
      try {
        window.__deferredPWAInstallPrompt = event;
        window.dispatchEvent(new Event("pwa-install-prompt-ready"));
      } catch {}
    };
    const onAppInstalled = () => {
      try {
        window.__deferredPWAInstallPrompt = null;
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const cleanup = () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };

    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return () => {
        cleanup();
      };
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then(registrations => {
          registrations.forEach(registration => {
            registration.unregister().catch(() => {});
          });
        })
        .catch(() => {});

      return cleanup;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/"
        });
      } catch (err) {
        console.warn("SW register failed", err);
      }
    };
    const id = setTimeout(register, 0);
    return () => {
      clearTimeout(id);
      cleanup();
    };
  }, []);
  return null;
}
