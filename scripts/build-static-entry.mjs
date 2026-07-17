import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const siteUrl = (
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  "https://bigpapastaters.com"
).replace(/\/+$/, "");
const serverModule = await import("../dist/server/index.js");
const response = await serverModule.default(new Request("http://localhost/"));

if (!response.ok) {
  throw new Error(`Could not prerender the homepage: ${response.status}`);
}

let html = await response.text();
const stylesheetPattern = /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?\s*>/gi;
const stylesheetLinks = [...html.matchAll(stylesheetPattern)];
const structuredDataScripts = html.match(
  /<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
) ?? [];

for (const [tag, href] of stylesheetLinks) {
  if (!href.startsWith("/_next/")) continue;
  const css = await readFile(`dist/client${href}`, "utf8");
  html = html.replace(tag, `<style data-site-styles>${css}</style>`);
}

// This is a content-led one-page site. Shipping the fully rendered document avoids
// keeping a JavaScript server process alive just to deliver static marketing copy.
html = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<link\b[^>]*rel="modulepreload"[^>]*\/?\s*>/gi, "")
  .replace(/<!--\$[^>]*-->|<!--\/\$-->/g, "");

html = html.replace(
  "</body>",
  `${structuredDataScripts.join("")}<script src="/live-location.js" defer></script></body>`,
);

const binaryAssets = {};
for (const [pathname, filename, contentType] of [
  ["/images/big-hoss-hero.webp", "public/images/big-hoss-hero.webp", "image/webp"],
  ["/images/loaded-potato-lineup.webp", "public/images/loaded-potato-lineup.webp", "image/webp"],
  ["/images/big-papas-logo.webp", "public/images/big-papas-logo.webp", "image/webp"],
]) {
  binaryAssets[pathname] = {
    body: (await readFile(filename)).toString("base64"),
    contentType,
  };
}

const textAssets = {
  "/": { body: html, contentType: "text/html; charset=utf-8", cacheControl: "no-cache" },
  "/index.html": { body: html, contentType: "text/html; charset=utf-8", cacheControl: "no-cache" },
  "/favicon.svg": {
    body: await readFile("public/favicon.svg", "utf8"),
    contentType: "image/svg+xml; charset=utf-8",
  },
  "/manifest.webmanifest": {
    body: await readFile("public/manifest.webmanifest", "utf8"),
    contentType: "application/manifest+json; charset=utf-8",
  },
  "/live-location.js": {
    body: await readFile("public/live-location.js", "utf8"),
    contentType: "text/javascript; charset=utf-8",
    cacheControl: "no-cache",
  },
  "/update": {
    body: await readFile("public/update/index.html", "utf8"),
    contentType: "text/html; charset=utf-8",
    cacheControl: "no-store",
  },
  "/update/": {
    body: await readFile("public/update/index.html", "utf8"),
    contentType: "text/html; charset=utf-8",
    cacheControl: "no-store",
  },
  "/update/index.html": {
    body: await readFile("public/update/index.html", "utf8"),
    contentType: "text/html; charset=utf-8",
    cacheControl: "no-store",
  },
  "/update/admin.css": {
    body: await readFile("public/update/admin.css", "utf8"),
    contentType: "text/css; charset=utf-8",
    cacheControl: "no-cache",
  },
  "/update/admin.js": {
    body: await readFile("public/update/admin.js", "utf8"),
    contentType: "text/javascript; charset=utf-8",
    cacheControl: "no-cache",
  },
  "/robots.txt": {
    body: `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`,
    contentType: "text/plain; charset=utf-8",
  },
  "/sitemap.xml": {
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}</loc><lastmod>2026-07-16</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n`,
    contentType: "application/xml; charset=utf-8",
  },
};

const netlifyOutputDirectory = "netlify-dist";
const notFoundHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#161412">
    <title>Page not found | Big Papa's Texas Loaded Potatoes</title>
    <link rel="icon" href="/favicon.svg">
    <style>
      :root { color-scheme: dark; font-family: Arial, Helvetica, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem; color: #f7efd9; background: #161412; }
      main { width: min(42rem, 100%); text-align: center; padding: clamp(2rem, 7vw, 4rem); border: 1px solid #a8854f; background: #211e1a; box-shadow: 0 1.25rem 4rem rgba(0, 0, 0, .35); }
      img { width: 8rem; height: 8rem; object-fit: contain; }
      p { margin: 1rem auto; max-width: 32rem; color: #d8c9aa; font-size: 1.05rem; line-height: 1.65; }
      .eyebrow { color: #dfb864; font-size: .78rem; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; }
      h1 { margin: .5rem 0 1rem; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2.5rem, 8vw, 4.5rem); line-height: .95; }
      a { display: inline-block; margin-top: 1rem; padding: .9rem 1.2rem; color: #fff7e6; background: #bd382b; border: 1px solid #d96a58; font-weight: 800; letter-spacing: .08em; text-decoration: none; text-transform: uppercase; }
      a:hover, a:focus-visible { background: #d04938; }
    </style>
  </head>
  <body>
    <main>
      <img src="/images/big-papas-logo.webp" alt="Big Papa's Texas Loaded Potatoes">
      <p class="eyebrow">Wrong turn, partner</p>
      <h1>This page rolled on.</h1>
      <p>Head back to Big Papa's and find something worth loading up.</p>
      <a href="/">Back to Big Papa's</a>
    </main>
  </body>
</html>`;

await rm(netlifyOutputDirectory, { recursive: true, force: true });
await mkdir(`${netlifyOutputDirectory}/images`, { recursive: true });
await mkdir(`${netlifyOutputDirectory}/update`, { recursive: true });

await Promise.all([
  writeFile(`${netlifyOutputDirectory}/index.html`, html),
  writeFile(`${netlifyOutputDirectory}/404.html`, notFoundHtml),
  writeFile(`${netlifyOutputDirectory}/robots.txt`, textAssets["/robots.txt"].body),
  writeFile(`${netlifyOutputDirectory}/sitemap.xml`, textAssets["/sitemap.xml"].body),
  cp("public/favicon.svg", `${netlifyOutputDirectory}/favicon.svg`),
  cp("public/manifest.webmanifest", `${netlifyOutputDirectory}/manifest.webmanifest`),
  cp("public/live-location.js", `${netlifyOutputDirectory}/live-location.js`),
  cp("public/update/index.html", `${netlifyOutputDirectory}/update/index.html`),
  cp("public/update/admin.css", `${netlifyOutputDirectory}/update/admin.css`),
  cp("public/update/admin.js", `${netlifyOutputDirectory}/update/admin.js`),
  cp("public/images/big-hoss-hero.webp", `${netlifyOutputDirectory}/images/big-hoss-hero.webp`),
  cp("public/images/loaded-potato-lineup.webp", `${netlifyOutputDirectory}/images/loaded-potato-lineup.webp`),
  cp("public/images/big-papas-logo.webp", `${netlifyOutputDirectory}/images/big-papas-logo.webp`),
]);

const runtime = `const TEXT_ASSETS = ${JSON.stringify(textAssets)};
const BINARY_ASSETS = ${JSON.stringify(binaryAssets)};

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; frame-src https://www.openstreetmap.org; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function handler(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...SECURITY_HEADERS, Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const pathname = new URL(request.url).pathname;
  const textAsset = TEXT_ASSETS[pathname];
  const binaryAsset = BINARY_ASSETS[pathname];
  const responseHeaders = pathname.startsWith("/update")
    ? { ...SECURITY_HEADERS, "X-Robots-Tag": "noindex, nofollow, noarchive" }
    : SECURITY_HEADERS;

  if (!textAsset && !binaryAsset) {
    return new Response(request.method === "HEAD" ? null : "Not Found", {
      status: 404,
      headers: { ...responseHeaders, "Cache-Control": "no-cache", "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const asset = textAsset || binaryAsset;
  const body = request.method === "HEAD"
    ? null
    : binaryAsset
      ? decodeBase64(binaryAsset.body)
      : textAsset.body;

  return new Response(body, {
    status: 200,
    headers: {
      ...responseHeaders,
      "Cache-Control": asset.cacheControl || "public, max-age=3600",
      "Content-Type": asset.contentType
    }
  });
}

export default { fetch: handler };
`;

await writeFile("dist/index.js", runtime);
