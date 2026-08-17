"use client";

import { useState } from "react";
import styles from "./quiz.module.css";

export function ShareButtons({ resultName }: { resultName: string }) {
  const [copied, setCopied] = useState(false);

  function facebookShare() {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, "facebook-share", "popup,width=680,height=640");
  }

  async function shareResult() {
    const data = {
      title: `I got ${resultName}!`,
      text: `I got ${resultName} in Big Papa's tater personality quiz. Which tater are you?`,
      url: window.location.href,
    };

    if (navigator.share) {
      await navigator.share(data).catch(() => undefined);
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className={styles.shareButtons}>
      <button type="button" className={styles.facebookButton} onClick={facebookShare}>
        <span aria-hidden="true">f</span> Share on Facebook
      </button>
      <button type="button" className={styles.secondaryButton} onClick={shareResult}>
        {copied ? "Link copied!" : "Share another way"}
      </button>
    </div>
  );
}

