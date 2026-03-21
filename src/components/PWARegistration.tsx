"use client";

import { useEffect } from "react";
import { scheduleNonCriticalTask } from "@/lib/utils/schedule";

export default function PWARegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const disableServiceWorker = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }
      } catch {
        // Ignore cleanup failures while cache is temporarily disabled.
      }
    };

    const runCleanup = () => {
      const scheduledTask = scheduleNonCriticalTask(() => {
        void disableServiceWorker();
      }, 2000);

      return () => scheduledTask.cancel();
    };

    if (document.readyState === "complete") {
      return runCleanup();
    }

    let cleanup: () => void = () => undefined;
    const onLoad = () => {
      cleanup = runCleanup();
    };

    window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      cleanup();
    };
  }, []);

  return null;
}
