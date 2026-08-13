(() => {
  "use strict";

  const products = document.querySelector("[data-public-menu-products]");
  const addOns = document.querySelector("[data-public-menu-add-ons]");
  const drinks = document.querySelector("[data-public-menu-drinks]");
  const combo = document.querySelector("[data-public-menu-combo]");
  const status = document.querySelector("[data-public-menu-status]");
  if (!products || !addOns || !drinks) return;

  const syncIntervalMs = 5_000;
  let currentRevision = null;
  let refreshInFlight = false;

  const starIcon = '<svg class="icon icon--star" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.1l6.2-.9L12 2.5Z"/></svg>';

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function validItem(item) {
    return item && typeof item === "object" && typeof item.name === "string";
  }

  function createProduct(item) {
    const article = document.createElement("article");
    const accent = ["red", "blue", "gold"].includes(item.accent) ? item.accent : "red";
    article.className = `menu-card menu-card--${accent}${item.isNew ? " menu-card--new" : ""}${item.available === false ? " menu-card--sold-out" : ""}`;
    article.dataset.publicMenuProduct = "";

    const topline = document.createElement("div");
    topline.className = "menu-card-topline";
    const eyebrow = document.createElement("p");
    eyebrow.textContent = item.eyebrow || "Loaded potato";
    topline.appendChild(eyebrow);
    if (item.isNew) {
      const badge = document.createElement("span");
      badge.className = "new-tag";
      badge.textContent = "New";
      topline.appendChild(badge);
    }

    const heading = document.createElement("div");
    heading.className = "menu-card-heading";
    const title = document.createElement("h3");
    title.textContent = item.name;
    const price = document.createElement("strong");
    price.className = "menu-price";
    price.textContent = item.price || "";
    heading.append(title, price);

    const rule = document.createElement("span");
    rule.className = "menu-rule";
    const description = document.createElement("p");
    description.className = "menu-description";
    description.textContent = item.description || "";
    article.append(topline, heading, rule, description);

    if (item.available === false) {
      const soldOut = document.createElement("span");
      soldOut.className = "sold-out-tag";
      soldOut.textContent = "Sold out today";
      article.appendChild(soldOut);
    } else if (item.id === "big-hoss" || item.name.trim().toLowerCase() === "the big hoss") {
      const signature = document.createElement("span");
      signature.className = "signature-tag";
      signature.innerHTML = `${starIcon} Papa's pick`;
      article.appendChild(signature);
    }

    return article;
  }

  function createSmallItem(item) {
    const row = document.createElement("li");
    if (item.available === false) row.className = "price-list-item--sold-out";
    const name = document.createElement("span");
    name.textContent = item.name;
    const price = document.createElement("strong");
    price.textContent = item.available === false ? "Sold out" : (item.price || "");
    row.append(name, price);
    return row;
  }

  function renderMenu(menu) {
    const visibleProducts = Array.isArray(menu.products)
      ? menu.products.filter((item) => validItem(item) && item.visible !== false)
      : [];
    products.replaceChildren(...visibleProducts.map(createProduct));

    const visibleAddOns = Array.isArray(menu.addOns)
      ? menu.addOns.filter((item) => validItem(item) && item.visible !== false)
      : [];
    addOns.replaceChildren(...visibleAddOns.map(createSmallItem));

    const visibleDrinks = Array.isArray(menu.drinks)
      ? menu.drinks.filter((item) => validItem(item) && item.visible !== false)
      : [];
    drinks.replaceChildren(...visibleDrinks.map(createSmallItem));

    if (combo) {
      combo.hidden = menu.combo?.enabled === false;
      setText(combo.querySelector("[data-public-menu-combo-label]"), menu.combo?.label || "Add a combo");
      setText(combo.querySelector("[data-public-menu-combo-description]"), menu.combo?.description || "Add any drink + cookie");
      setText(combo.querySelector("[data-public-menu-combo-price]"), menu.combo?.price || "$4.00");
    }

    currentRevision = Number(menu.revision) || JSON.stringify(menu);
    if (status) {
      status.classList.remove("is-offline");
      status.textContent = "Today’s live menu — availability updates automatically.";
    }
  }

  async function refreshMenu() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const response = await fetch(`/api/menu?sync=${Date.now()}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!response.ok) throw new Error("Menu unavailable");
      const menu = await response.json();
      const nextRevision = Number(menu.revision) || JSON.stringify(menu);
      if (nextRevision !== currentRevision) renderMenu(menu);
      else if (status) {
        status.classList.remove("is-offline");
        status.textContent = "Today’s live menu — availability updates automatically.";
      }
    } catch {
      if (status) {
        status.classList.add("is-offline");
        status.textContent = "Showing the latest saved menu. Availability may have changed.";
      }
    } finally {
      refreshInFlight = false;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshMenu();
  });
  window.addEventListener("focus", () => void refreshMenu());
  window.addEventListener("online", () => void refreshMenu());
  window.addEventListener("pageshow", () => void refreshMenu());

  void refreshMenu();
  window.setInterval(() => void refreshMenu(), syncIntervalMs);
})();
