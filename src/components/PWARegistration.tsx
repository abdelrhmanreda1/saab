"use client";

import { useEffect } from "react";

export default function PWARegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        registration.update().catch(() => {
          // Ignore best-effort update failures during registration.
        });
      } catch {
        // Ignore registration failures in local/dev environments.
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
