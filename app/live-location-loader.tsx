"use client";

import { useEffect } from "react";

export function LiveLocationLoader() {
  useEffect(() => {
    const scripts = [
      { selector: "script[data-live-location-loader]", src: "/live-location.js", key: "liveLocationLoader" },
      { selector: "script[data-calendar-events-loader]", src: "/calendar-events.js", key: "calendarEventsLoader" },
    ] as const;

    for (const item of scripts) {
      if (document.querySelector(item.selector)) continue;
      const script = document.createElement("script");
      script.src = item.src;
      script.dataset[item.key] = "true";
      document.body.appendChild(script);
    }
  }, []);

  return null;
}
