(() => {
  "use strict";

  const products = document.querySelector("[data-public-menu-products]");
  const addOns = document.querySelector("[data-public-menu-add-ons]");
  const drinks = document.querySelector("[data-public-menu-drinks]");
  const combo = document.querySelector("[data-public-menu-combo]");
  const desserts = document.querySelector("[data-public-menu-desserts]");
  const dessertsSection = document.querySelector("[data-public-menu-desserts-section]");
  const cobblerCombo = document.querySelector("[data-public-menu-cobbler-combo]");
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

  function priceInCents(value) {
    const amount = Number(String(value ?? "").replace(/^\$/, ""));
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
  }

  function productPrice(value, lunchPricing) {
    if (lunchPricing?.enabled !== true) return value;
    const cents = Math.max(0, priceInCents(value) - priceInCents(lunchPricing.reduction));
    return `$${(cents / 100).toFixed(2)}`;
  }

  function createProduct(item, lunchPricing, cooking, friesEnabled) {
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
    price.textContent = productPrice(item.price || "", lunchPricing);
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
    } else if (cooking) {
      const waiting = document.createElement("span");
      waiting.className = "cooking-tag";
      waiting.textContent = friesEnabled ? "Fries only · Baked potatoes cooking" : "Temporarily sold out · Taters cooking";
      article.appendChild(waiting);
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
    const cooking = menu.board?.tatersCooking === true;
    const friesEnabled = menu.friesEnabled !== false;
    const notice = document.querySelector("[data-public-cooking-notice]");
    const message = document.querySelector("[data-public-cooking-message]");
    const cookingTitle = document.querySelector("[data-public-cooking-title]");
    const cookingDetail = document.querySelector("[data-public-cooking-detail]");
    const baseCopy = document.querySelector("[data-public-base-copy]");
    if (notice) notice.hidden = !cooking;
    setText(cookingTitle, friesEnabled
      ? "Baked potatoes are cooking — loaded fries are still available!"
      : "Temporarily sold out — more taters are cooking!");
    setText(cookingDetail, friesEnabled
      ? "Choose fries with any loaded favorite. Same toppings. Same price."
      : "Thanks for your patience. Ask us about the next batch.");
    setText(baseCopy, friesEnabled
      ? "Choose every loaded favorite on a baked potato or French fries. Same toppings. Same price."
      : "Every loaded favorite starts with a hot, fluffy baked potato and ends loaded.");
    if (message) {
      message.textContent = menu.board?.cookingMessage || "";
      message.hidden = !menu.board?.cookingMessage;
    }
    const visibleProducts = Array.isArray(menu.products)
      ? menu.products.filter((item) => validItem(item) && item.visible !== false)
      : [];
    products.replaceChildren(...visibleProducts.map((item) => createProduct(item, menu.lunchPricing, cooking, friesEnabled)));

    const visibleAddOns = Array.isArray(menu.addOns)
      ? menu.addOns.filter((item) => validItem(item) && item.visible !== false)
      : [];
    addOns.replaceChildren(...visibleAddOns.map(createSmallItem));

    const visibleDrinks = Array.isArray(menu.drinks)
      ? menu.drinks.filter((item) => validItem(item) && item.visible !== false)
      : [];
    drinks.replaceChildren(...visibleDrinks.map(createSmallItem));

    const visibleDesserts = Array.isArray(menu.desserts)
      ? menu.desserts.filter((item) => validItem(item) && item.visible !== false)
      : [];
    if (desserts) desserts.replaceChildren(...visibleDesserts.map(createSmallItem));
    if (dessertsSection) dessertsSection.hidden = visibleDesserts.length === 0;

    const drinksEnabled = menu.drinksEnabled !== false;
    const drinksSection = drinks.closest(".menu-panel--drinks");
    if (drinksSection) drinksSection.hidden = !drinksEnabled;

    if (combo) {
      combo.hidden = !drinksEnabled || menu.combo?.enabled === false;
      setText(combo.querySelector("[data-public-menu-combo-label]"), menu.combo?.label || "Add a combo");
      setText(combo.querySelector("[data-public-menu-combo-description]"), menu.combo?.description || "Add any drink + cookie");
      setText(combo.querySelector("[data-public-menu-combo-price]"), menu.combo?.price || "$4.00");
    }
    if (cobblerCombo) {
      cobblerCombo.hidden = !drinksEnabled || menu.cobblerCombo?.enabled === false || visibleDesserts.every((item) => item.available === false);
      setText(cobblerCombo.querySelector("[data-public-menu-cobbler-combo-label]"), menu.cobblerCombo?.label || "Cobbler combo");
      setText(cobblerCombo.querySelector("[data-public-menu-cobbler-combo-description]"), menu.cobblerCombo?.description || "Any drink + choice of cobbler");
      setText(cobblerCombo.querySelector("[data-public-menu-cobbler-combo-price]"), menu.cobblerCombo?.price || "$5.00");
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
