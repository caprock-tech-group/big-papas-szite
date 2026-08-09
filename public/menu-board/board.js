(() => {
  "use strict";

  const board = document.querySelector("[data-board]");
  const products = document.querySelector("[data-products]");
  const addOns = document.querySelector("[data-add-ons]");
  const drinks = document.querySelector("[data-drinks]");
  const combo = document.querySelector("[data-combo]");
  const announcement = document.querySelector("[data-announcement]");
  const boardStatus = document.querySelector("[data-board-status]");
  const screenControl = document.querySelector("[data-screen-control]");
  if (!board || !products || !addOns || !drinks) return;

  const params = new URLSearchParams(window.location.search);
  const orientationOverride = ["auto", "landscape", "portrait"].includes(params.get("orientation"))
    ? params.get("orientation")
    : null;
  const isPreview = params.get("preview") === "1";
  const cacheKey = "big-papas-menu-board-cache-v1";

  let currentMenu = null;
  let wakeLock = null;

  function text(element, value) {
    if (element) element.textContent = value;
  }

  function applyOrientation(preference) {
    const requested = orientationOverride || preference || "auto";
    const resolved = requested === "auto"
      ? (window.innerWidth >= window.innerHeight ? "landscape" : "portrait")
      : requested;
    board.dataset.orientation = resolved;
  }

  function createProduct(item) {
    const article = document.createElement("article");
    article.className = `product product--${item.accent || "red"}${item.available === false ? " is-sold-out" : ""}`;

    const copy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.textContent = item.eyebrow || "Loaded potato";
    if (item.isNew) {
      const badge = document.createElement("em");
      badge.textContent = "New";
      eyebrow.appendChild(badge);
    }
    const title = document.createElement("h3");
    title.textContent = item.name;
    const description = document.createElement("span");
    description.textContent = item.description || "";
    copy.append(eyebrow, title, description);

    const price = document.createElement("strong");
    price.textContent = item.price;
    article.append(copy, price);
    return article;
  }

  function renderSmallList(container, items) {
    const rows = items
      .filter((item) => item && item.visible !== false)
      .map((item) => {
        const row = document.createElement("p");
        if (item.available === false) row.classList.add("is-sold-out");
        const name = document.createElement("span");
        name.textContent = item.name;
        const price = document.createElement("strong");
        price.textContent = item.price;
        row.append(name, price);
        return row;
      });
    container.style.setProperty("--item-count", String(Math.max(rows.length, 1)));
    container.replaceChildren(...rows);
  }

  function renderMenu(menu) {
    if (!menu || typeof menu !== "object") return;
    currentMenu = menu;
    applyOrientation(menu.board?.orientation);
    board.dataset.showDescriptions = String(menu.board?.showDescriptions !== false);
    text(document.querySelector("[data-headline]"), menu.board?.headline || "Texas Loaded Potatoes");
    text(document.querySelector("[data-subheadline]"), menu.board?.subheadline || "Bold flavor. Texas style. Big portions.");

    const announcementText = typeof menu.board?.announcement === "string" ? menu.board.announcement.trim() : "";
    if (announcement) {
      announcement.hidden = !announcementText;
      announcement.textContent = announcementText;
    }

    const visibleProducts = Array.isArray(menu.products)
      ? menu.products.filter((item) => item && item.visible !== false)
      : [];
    products.style.setProperty("--product-count", String(Math.max(visibleProducts.length, 1)));
    products.replaceChildren(...visibleProducts.map(createProduct));
    renderSmallList(addOns, Array.isArray(menu.addOns) ? menu.addOns : []);
    renderSmallList(drinks, Array.isArray(menu.drinks) ? menu.drinks : []);

    if (combo) {
      combo.hidden = menu.combo?.enabled === false;
      text(combo.querySelector("[data-combo-label]"), menu.combo?.label || "Add a combo");
      text(combo.querySelector("[data-combo-description]"), menu.combo?.description || "Add any drink + cookie");
      text(combo.querySelector("[data-combo-price]"), menu.combo?.price || "$4.00");
    }
  }

  function setConnection(online) {
    boardStatus?.classList.toggle("is-offline", !online);
    text(boardStatus?.querySelector("span"), online ? "Menu live" : "Saved menu");
  }

  function readSavedMenu() {
    try {
      return JSON.parse(window.localStorage.getItem(cacheKey) || "null");
    } catch {
      return null;
    }
  }

  function saveLocalMenu(menu) {
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(menu));
    } catch {
      // The rendered page remains usable when local storage is unavailable.
    }
  }

  async function refreshMenu() {
    try {
      const response = await fetch(`/api/menu?board=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Menu unavailable");
      const menu = await response.json();
      if (!currentMenu || menu.revision !== currentMenu.revision || menu.updatedAt !== currentMenu.updatedAt) {
        renderMenu(menu);
      }
      saveLocalMenu(menu);
      setConnection(true);
    } catch {
      const saved = readSavedMenu();
      if (!currentMenu && saved) renderMenu(saved);
      setConnection(false);
    }
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      wakeLock = null;
    }
  }

  async function enterFullscreen() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      }
    } catch {
      // Some browsers, including iPhone browsers, do not support page fullscreen.
    }
    await requestWakeLock();
    updateScreenState();
  }

  function updateScreenState() {
    const fullscreen = Boolean(document.fullscreenElement);
    screenControl?.setAttribute("aria-label", fullscreen ? "Leave fullscreen" : "Enter fullscreen");
    screenControl?.setAttribute("title", fullscreen ? "Leave fullscreen" : "Enter fullscreen");
  }

  screenControl?.addEventListener("click", async () => {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else await enterFullscreen();
  });

  document.addEventListener("fullscreenchange", updateScreenState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wakeLock?.released) void requestWakeLock();
  });

  window.addEventListener("resize", () => {
    if ((orientationOverride || currentMenu?.board?.orientation || "auto") === "auto") {
      applyOrientation("auto");
    }
  });

  if (isPreview) {
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== "bigpapas-menu-preview") return;
      renderMenu(event.data.menu);
      setConnection(true);
    });
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/menu-board/sw.js", { scope: "/menu-board/" }).catch(() => {});
    });
  }

  const savedMenu = readSavedMenu();
  if (savedMenu) renderMenu(savedMenu);
  applyOrientation(savedMenu?.board?.orientation || "auto");
  updateScreenState();
  void refreshMenu();
  window.setInterval(refreshMenu, 10_000);
})();
