# Big Papa's Texas Loaded Potatoes

Production website for Big Papa's Texas Loaded Potatoes, built with the vinext/Next.js App Router toolchain and ready for either ChatGPT Sites or Netlify.

## Local development

```bash
npm install
npm run dev
```

Run the production checks with:

```bash
npm run check
npm run build
```

## Deploy on Netlify

This repository includes `netlify.toml`, so Netlify can detect the production settings automatically:

- Build command: `npm run build:netlify`
- Publish directory: `netlify-dist`
- Required environment variables: none

Import the repository from GitHub and select **Deploy**. Netlify will rebuild and publish the site after every push to the production branch.

When a custom domain is assigned, trigger one fresh production deploy. The build will then use that domain for the canonical URL, structured data, `robots.txt`, and `sitemap.xml`.

## Content updates

Business links, service area, and menu items are centralized in `app/site-config.ts`.

- Online ordering is configured through the live SkyTab portal in `onlineOrderUrl`.
- The optimized official logo and food photography live in `public/images`.
- Current stop information intentionally links to the live `@bigpapastaters` Facebook page so the site never displays a stale schedule.

The site does not collect visitor data, set marketing cookies, or accept payments directly.
