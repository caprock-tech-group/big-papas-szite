import type { MetadataRoute } from "next";
import { siteConfig } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.siteUrl,
      lastModified: new Date("2026-07-16"),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
