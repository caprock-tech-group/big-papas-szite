"use client";

import { useEffect } from "react";

export function LiveLocationLoader() {
  useEffect(() => {
    if (document.querySelector("script[data-live-location-loader]")) return;

    const script = document.createElement("script");
    script.src = "/live-location.js";
    script.dataset.liveLocationLoader = "true";
    document.body.appendChild(script);
  }, []);

  return null;
}
