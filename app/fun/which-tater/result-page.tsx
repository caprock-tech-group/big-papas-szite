import type { CSSProperties } from "react";
import { siteConfig } from "../../site-config";
import { ShareButtons } from "./share-buttons";
import { taterResults, type TaterSlug } from "./quiz-data";
import styles from "./quiz.module.css";

export function resultShareUrl(slug: TaterSlug) {
  const baseUrl = (
    process.env.DEPLOY_PRIME_URL
    || process.env.URL
    || siteConfig.siteUrl
  ).replace(/\/+$/, "");
  return `${baseUrl}/fun/which-tater/${slug}`;
}

export function TaterResultPage({ slug }: { slug: TaterSlug }) {
  const result = taterResults[slug];

  return (
    <main className={styles.resultPage} style={{ "--result-accent": result.accent } as CSSProperties}>
      <div className={styles.texture} aria-hidden="true" />
      <header className={styles.resultHeader}>
        <a href="/" aria-label="Back to Big Papa's home page">
          <img src="/images/big-papas-logo.webp" alt="Big Papa's Texas Loaded Potatoes" width="900" height="900" />
        </a>
        <p>Big Papa&apos;s personality test</p>
      </header>

      <section className={styles.resultShell}>
        <div className={styles.resultCardFrame}>
          <img src={result.card} alt={`I got ${result.name} — ${result.persona}`} width="1200" height="630" />
        </div>

        <div className={styles.resultCopy}>
          <p>Your loaded destiny</p>
          <h1>You&apos;re {result.name}.</h1>
          <h2>{result.persona}</h2>
          <strong>{result.kicker}</strong>
          <p>{result.description}</p>
          <blockquote>{result.verdict}</blockquote>

          <ShareButtons resultName={result.name} />

          <div className={styles.resultActions}>
            <a href={siteConfig.onlineOrderUrl} target="_blank" rel="noreferrer noopener">Order your tater →</a>
            <a href="/fun/which-tater">Take it again</a>
          </div>
        </div>
      </section>

      <footer className={styles.quizFooter}>
        <span>★</span> Big portions. Bold flavor. Texas style. <span>★</span>
      </footer>
    </main>
  );
}
