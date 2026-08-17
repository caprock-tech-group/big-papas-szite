import type { Metadata } from "next";
import { resultShareUrl } from "./result-page";
import { taterResults, type TaterSlug } from "./quiz-data";

export function createResultMetadata(slug: TaterSlug): Metadata {
  const result = taterResults[slug];
  const shareUrl = resultShareUrl(slug);
  const imageUrl = new URL(result.card, shareUrl).toString();
  const title = `I got ${result.name} — ${result.persona}`;
  const description = `${result.kicker} Take Big Papa's loaded tater personality quiz and find out which tater you are.`;

  return {
    title,
    description,
    alternates: { canonical: shareUrl },
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      url: shareUrl,
      siteName: "Big Papa's Texas Loaded Potatoes",
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

