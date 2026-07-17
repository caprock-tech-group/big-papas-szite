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
- Required environment variable: `LOCATION_ADMIN_PASSWORD` (a private shared password of at least 12 characters)

Import the repository from GitHub and select **Deploy**. Netlify will rebuild and publish the site after every push to the production branch.

When a custom domain is assigned, trigger one fresh production deploy. The build will then use that domain for the canonical URL, structured data, `robots.txt`, and `sitemap.xml`.

Add `LOCATION_ADMIN_PASSWORD` in Netlify's environment-variable settings and keep it out of the repository. Trigger a new production deploy after adding or changing it so the location functions receive the value.

## Live truck location

The public homepage checks `/api/location` once a minute and displays the current truck pin when one is active. The shared private updater lives at `/update/` and supports:

- a one-time phone location lookup after the truck is parked;
- an optional stop name, serving hours, and customer note;
- automatic expiration after 4, 8, or 12 hours;
- immediate removal of the public pin.

The location is stored in Netlify Blobs and persists across deploys. The updater does not track the phone in the background.

For the convenient updater address, add `update.bigpapastaters.com` as a Netlify domain alias and create a Squarespace DNS CNAME named `update` that points to `bigpapaswebsite.netlify.app`. Requests to that subdomain are redirected to the secure updater on the main domain.

## Content updates

Business links, service area, and menu items are centralized in `app/site-config.ts`.

- Online ordering is configured through the live SkyTab portal in `onlineOrderUrl`.
- The optimized official logo and food photography live in `public/images`.
- Current stop information falls back to the live `@bigpapastaters` Facebook page whenever no unexpired location pin is active.

The site does not collect visitor data, set marketing cookies, or accept payments directly.
