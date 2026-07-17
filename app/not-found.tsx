import { siteConfig } from "./site-config";

export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow eyebrow--light"><span /> Wrong turn, partner</p>
      <h1>This page rolled on.</h1>
      <p>Head back to Big Papa&apos;s and find something worth loading up.</p>
      <a className="button button--primary" href={siteConfig.siteUrl}>Back to Big Papa&apos;s</a>
    </main>
  );
}
