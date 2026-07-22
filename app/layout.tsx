import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LiveLocationLoader } from "./live-location-loader";
import { siteConfig } from "./site-config";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "Big Papa's Texas Loaded Potatoes",
    template: "%s | Big Papa's Texas Loaded Potatoes",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "loaded potatoes",
    "food truck Amarillo",
    "food trailer Claude Texas",
    "Texas Panhandle food truck",
    "brisket baked potato",
    "The Big Hoss",
  ],
  authors: [{ name: "Big Papa's Texas Loaded Potatoes" }],
  creator: "Big Papa's Texas Loaded Potatoes",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: siteConfig.name,
    title: "Big Papa's Texas Loaded Potatoes",
    description: "Home of The Big Hoss. Big Portions. Bold Flavor. Texas Style.",
    images: [
      {
        url: "/images/big-hoss-hero.webp",
        width: 1774,
        height: 887,
        alt: "A Texas-sized brisket loaded baked potato",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Big Papa's Texas Loaded Potatoes",
    description: "Home of The Big Hoss. Big Portions. Bold Flavor. Texas Style.",
    images: ["/images/big-hoss-hero.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#161412",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <LiveLocationLoader />
      </body>
    </html>
  );
}
