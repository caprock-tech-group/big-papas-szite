import { drinks, menuAddOns, menuItems, siteConfig } from "./site-config";

const externalLinkProps = {
  target: "_blank",
  rel: "noreferrer noopener",
} as const;

function ArrowIcon() {
  return (
    <svg className="icon icon--arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="icon icon--facebook" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 8h3V4.2c-.5-.1-2.1-.2-3.3-.2C11 4 9 5.7 9 8.8V12H6v4h3v8h4v-8h3.3l.7-4H13V9.2c0-.8.3-1.2 1-1.2Z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="icon icon--map-pin" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="icon icon--truck" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg className="icon icon--bag" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12l1 13H5L6 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="icon icon--star" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2.5 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.1l6.2-.9L12 2.5Z" />
    </svg>
  );
}

function BrandLockup({ footer = false }: { footer?: boolean }) {
  return (
    <span className={footer ? "brand brand--footer" : "brand"} aria-label={siteConfig.name}>
      <span className="brand-logo-shell" aria-hidden="true">
        <img
          className="brand-logo"
          src="/images/big-papas-logo.webp"
          alt=""
          width="900"
          height="900"
        />
      </span>
      <span className="brand-words">
        <strong>Big Papa&apos;s</strong>
        <small>Texas Loaded Potatoes</small>
      </span>
    </span>
  );
}

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: siteConfig.name,
    url: siteConfig.siteUrl,
    image: `${siteConfig.siteUrl}/images/big-hoss-hero.webp`,
    logo: `${siteConfig.siteUrl}/images/big-papas-logo.webp`,
    description: siteConfig.description,
    servesCuisine: ["Texas comfort food", "Loaded baked potatoes", "Barbecue"],
    priceRange: "$12.99–$18.99",
    hasMenu: `${siteConfig.siteUrl}/#menu`,
    potentialAction: {
      "@type": "OrderAction",
      target: siteConfig.onlineOrderUrl,
    },
    sameAs: [siteConfig.facebookUrl],
    areaServed: [
      { "@type": "City", name: "Claude, Texas" },
      { "@type": "City", name: "Amarillo, Texas" },
      { "@type": "AdministrativeArea", name: "Texas Panhandle" },
    ],
  };

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>

      <div className="announcement" role="note">
        <span><StarIcon /></span>
        <p>Based in Claude • Rolling across the Texas Panhandle</p>
        <span><StarIcon /></span>
      </div>

      <header className="site-header">
        <a className="brand-link" href="#top">
          <BrandLockup />
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#menu">Menu</a>
          <a href="#find-us">Find us</a>
          <a href="#our-story">Our story</a>
          <a href={siteConfig.facebookUrl} {...externalLinkProps}>Facebook</a>
          <a className="nav-cta nav-cta--order" href={siteConfig.onlineOrderUrl} {...externalLinkProps}>
            <BagIcon /> Order online
          </a>
        </nav>

        <details className="mobile-nav">
          <summary aria-label="Open navigation"><span /><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            <a href="#menu">Menu</a>
            <a href="#find-us">Find us</a>
            <a href="#our-story">Our story</a>
            <a href={siteConfig.facebookUrl} {...externalLinkProps}>Facebook</a>
            <a className="mobile-order-link" href={siteConfig.onlineOrderUrl} {...externalLinkProps}>
              Order online
            </a>
          </nav>
        </details>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <img
            className="hero-image"
            src="/images/big-hoss-hero.webp"
            alt="A Texas-sized baked potato loaded with smoked brisket and melted cheese"
            width="1774"
            height="887"
            fetchPriority="high"
          />
          <div className="hero-overlay" />
          <div className="hero-grain" />
          <div className="hero-content">
            <p className="eyebrow eyebrow--light"><span /> Home of The Big Hoss</p>
            <h1 id="hero-title">
              Big portions.<br />
              <em>Bold flavor.</em><br />
              Texas style.
            </h1>
            <p className="hero-copy">
              Fully loaded baked potatoes made to satisfy and served hot from our family-owned
              mobile kitchen across the Texas Panhandle.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href={siteConfig.onlineOrderUrl} {...externalLinkProps}>
                <BagIcon /> Order online
              </a>
              <a className="button button--ghost" href="#menu">
                Explore the menu <ArrowIcon />
              </a>
            </div>
            <ul className="hero-proof" aria-label="What makes Big Papa's special">
              <li><span><StarIcon /></span> Texas-sized portions</li>
              <li><span><TruckIcon /></span> Panhandle-owned</li>
            </ul>
          </div>
          <div className="hero-caption" aria-hidden="true">
            <span>01</span>
            <div><strong>The Big Hoss</strong><small>Smoked brisket • Signature potato</small></div>
          </div>
        </section>

        <section className="menu-section" id="menu" aria-labelledby="menu-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span /> Meet the heavy hitters</p>
              <h2 id="menu-title">Pick your potato.</h2>
            </div>
            <p>
              From slow-smoked brisket and chicken fried steak to breakfast and pizza-night
              flavor, every option starts with a hot, fluffy baked potato and ends loaded.
            </p>
          </div>

          <div className="menu-grid">
            {menuItems.map((item) => (
              <article
                className={`menu-card menu-card--${item.accent}${item.isNew ? " menu-card--new" : ""}`}
                key={item.name}
              >
                <div className="menu-card-topline">
                  <p>{item.eyebrow}</p>
                  {item.isNew && <span className="new-tag">New</span>}
                </div>
                <div className="menu-card-heading">
                  <h3>{item.name}</h3>
                  <strong className="menu-price">{item.price}</strong>
                </div>
                <span className="menu-rule" />
                <p className="menu-description">{item.description}</p>
                {item.name === "The Big Hoss" && (
                  <span className="signature-tag"><StarIcon /> Papa&apos;s pick</span>
                )}
              </article>
            ))}
          </div>

          <p className="availability-note">Menu selections and availability may vary by stop.</p>

          <aside className="order-callout" aria-labelledby="order-callout-title">
            <div>
              <p>Skip the wait</p>
              <h3 id="order-callout-title">Order ahead with SkyTab.</h3>
              <span>Build your order online, then pick it up hot from the Big Papa&apos;s trailer.</span>
            </div>
            <a className="button button--cream" href={siteConfig.onlineOrderUrl} {...externalLinkProps}>
              Start your order <ArrowIcon />
            </a>
          </aside>

          <div className="menu-extras" aria-label="Add-ons and drinks">
            <section className="menu-panel" aria-labelledby="addons-title">
              <p className="eyebrow"><span /> Make it yours</p>
              <h3 id="addons-title">Add-ons</h3>
              <ul className="price-list price-list--addons">
                {menuAddOns.map((item) => (
                  <li key={item.name}><span>{item.name}</span><strong>{item.price}</strong></li>
                ))}
              </ul>
            </section>

            <section className="menu-panel menu-panel--drinks" aria-labelledby="drinks-title">
              <p className="eyebrow"><span /> Ice cold</p>
              <h3 id="drinks-title">Drinks</h3>
              <ul className="price-list">
                {drinks.map((item) => (
                  <li key={item.name}><span>{item.name}</span><strong>{item.price}</strong></li>
                ))}
              </ul>
              <div className="combo-callout">
                <div><small>Add a combo</small><strong>Add any drink + cookie</strong></div>
                <span>$4.00</span>
              </div>
            </section>
          </div>

          <figure className="lineup-photo">
            <img
              src="/images/loaded-potato-lineup.webp"
              alt="Mac and cheese, pulled pork, and pepperoni pizza loaded baked potatoes"
              width="1774"
              height="887"
              loading="lazy"
            />
            <figcaption>
              <p>Make it a meal</p>
              <strong>Add a cookie + drink for $4.00</strong>
              <span>Drinks $3 • Water $2</span>
            </figcaption>
          </figure>
        </section>

        <section className="find-section" id="find-us" aria-labelledby="find-title" data-live-location>
          <div className="find-map" data-live-map>
            <div className="find-map-placeholder" data-live-placeholder aria-hidden="true">
              <div className="route route--one" />
              <div className="route route--two" />
              <span className="map-label map-label--claude">Claude</span>
              <span className="map-label map-label--amarillo">Amarillo</span>
              <span className="map-pin map-pin--claude"><MapPinIcon /></span>
              <span className="map-pin map-pin--amarillo"><MapPinIcon /></span>
              <div className="truck-badge"><TruckIcon /><span>Big Papa<br />Tracker</span></div>
            </div>
            <iframe
              className="live-map-frame"
              data-live-map-frame
              title="Big Papa's current location map"
              loading="lazy"
              referrerPolicy="no-referrer"
              hidden
            />
            <div className="live-map-badge" data-live-map-badge hidden>
              <span aria-hidden="true" /> Live now
            </div>
          </div>

          <div className="find-content">
            <p className="eyebrow eyebrow--light"><span /> Live truck locator</p>
            <h2 id="find-title" data-live-title>Catch us when we roll into town.</h2>
            <p data-live-summary>
              When we&apos;re parked and serving, our live pin appears here. Check Facebook for
              upcoming stops, service times, and sellout updates.
            </p>
            <div className="location-card" data-live-card aria-live="polite">
              <MapPinIcon />
              <div>
                <small data-live-kicker>Current status</small>
                <strong data-live-place>Waiting for today&apos;s stop</strong>
                <span className="location-updated" data-live-updated>Serving {siteConfig.serviceArea}</span>
              </div>
              <span className="location-status-dot" data-live-status-dot aria-hidden="true" />
            </div>
            <div className="live-details" data-live-details hidden>
              <p data-live-hours hidden />
              <p data-live-note hidden />
            </div>
            <div className="live-location-actions">
              <a className="button button--primary" data-live-directions href="#" {...externalLinkProps} hidden>
                <MapPinIcon /> Get directions
              </a>
              <a className="button button--ghost" href={siteConfig.facebookUrl} {...externalLinkProps}>
                <FacebookIcon /> Schedule updates
              </a>
            </div>
          </div>
        </section>

        <section className="story-section" id="our-story" aria-labelledby="story-title">
          <div className="story-copy">
            <p className="eyebrow"><span /> Panhandle roots</p>
            <h2 id="story-title">Built in Claude.<br />Made for Texas.</h2>
            <p className="story-lead">
              Big Papa&apos;s is a family-owned mobile kitchen with one straightforward mission:
              serve bold, satisfying food that earns its name.
            </p>
            <p>
              We started with the humble baked potato, gave it a Texas-sized upgrade, and built a
              menu around the kind of comfort food people actually get excited about. Wherever the
              trailer lands, come hungry.
            </p>
            <div className="story-signoff">
              <span><StarIcon /></span>
              <div><strong>Proudly Panhandle-owned</strong><small>{siteConfig.homeBase}</small></div>
            </div>
          </div>

          <aside className="brand-crest" aria-label="Big Papa's official logo">
            <img
              src="/images/big-papas-logo.webp"
              alt="Big Papa's Texas Loaded Potatoes official logo"
              width="900"
              height="900"
              loading="lazy"
            />
            <p>{siteConfig.tagline}</p>
          </aside>
        </section>

        <section className="event-section" aria-labelledby="event-title">
          <div>
            <p className="eyebrow eyebrow--light"><span /> Bring the big flavor</p>
            <h2 id="event-title">Want Big Papa&apos;s at your event?</h2>
            <p>Community events, workplace lunches, private gatherings—we&apos;d love to hear what you&apos;re planning.</p>
          </div>
          <a className="button button--cream" href={siteConfig.messengerUrl} {...externalLinkProps}>
            Message Big Papa&apos;s <ArrowIcon />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <BrandLockup footer />
          <p>{siteConfig.tagline}</p>
          <nav aria-label="Footer navigation">
            <a href="#menu">Menu</a>
            <a href="#find-us">Find us</a>
            <a href="#our-story">Our story</a>
            <a href={siteConfig.facebookUrl} {...externalLinkProps}>Facebook</a>
            <a href={siteConfig.onlineOrderUrl} {...externalLinkProps}>Order online</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Big Papa&apos;s Texas Loaded Potatoes. All rights reserved.</p>
          <p>Family-owned in Claude, Texas.</p>
        </div>
      </footer>

      <nav className="mobile-action-bar" aria-label="Quick actions">
        <a href="#menu">View menu</a>
        <a href={siteConfig.onlineOrderUrl} {...externalLinkProps}>Order online <ArrowIcon /></a>
      </nav>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
