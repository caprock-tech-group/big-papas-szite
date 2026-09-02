(() => {
  "use strict";

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const el = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = text;
    return node;
  };
  const deepClone = (value) => typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
  const reviewMode = location.hostname.startsWith("deploy-preview-");

  const views = {
    today: ["Daily operations", "Today"],
    location: ["Customer visibility", "Live location"],
    menu: ["Availability & displays", "Menu"],
    events: ["Forecast & production", "Events"],
    marketing: ["Facebook & calendar", "Marketing"],
    reports: ["Forecast versus actual", "Results"],
  };

  const state = {
    location: null,
    locationExpired: false,
    facebook: null,
    menu: null,
    planner: null,
    calendar: { configured: false, events: [] },
    refreshedAt: null,
    activeView: views[new URLSearchParams(location.search).get("view")] ? new URLSearchParams(location.search).get("view") : "today",
    activeEventId: null,
    coords: null,
    menuDirty: false,
    plannerDirty: false,
    openProducts: new Set(),
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    let result = {};
    try { result = await response.json(); } catch { result = {}; }
    return { response, result };
  }

  function setMessage(target, text = "", type = "") {
    const node = typeof target === "string" ? qs(target) : target;
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-error", type === "error");
    node.classList.toggle("is-success", type === "success");
    node.hidden = !text && node.hasAttribute("data-global-message");
  }

  function globalMessage(text = "", type = "") {
    setMessage("[data-global-message]", text, type);
    if (text) qs("[data-global-message]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function busy(button, isBusy, busyLabel = "Working…") {
    if (!button) return;
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
    button.disabled = isBusy;
    button.textContent = isBusy ? busyLabel : button.dataset.originalLabel;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function optionalNumber(value) {
    return value === "" || value === null || value === undefined ? null : number(value, null);
  }

  function formatDate(value, options = {}) {
    if (!value) return "Date not set";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return "Date not set";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      year: options.year ? "numeric" : undefined,
      weekday: options.weekday ? "short" : undefined,
    }).format(date);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "recently";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function formatCalendarTime(event) {
    if (event.allDay) return "All day";
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (Number.isNaN(start.getTime())) return "Time not set";
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
    return Number.isNaN(end.getTime()) ? formatter.format(start) : `${formatter.format(start)}–${formatter.format(end)}`;
  }

  function speedLabel(value) {
    const speed = number(value, 65);
    if (speed <= 45) return "Slow";
    if (speed <= 85) return "Normal";
    if (speed <= 145) return "Fast";
    return "Very fast";
  }

  function priceInCents(value) {
    const amount = Number(String(value ?? "").replace(/^\$/, ""));
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
  }

  function formatPrice(cents) {
    return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
  }

  function lunchProductPrice(price) {
    if (state.menu?.lunchPricing?.enabled !== true) return price;
    return formatPrice(priceInCents(price) - priceInCents(state.menu.lunchPricing.reduction));
  }

  function showLogin(text = "", type = "") {
    qs("[data-login-screen]").hidden = false;
    qs("[data-command-shell]").hidden = true;
    setMessage("[data-login-message]", text, type);
  }

  function showCommandCenter() {
    qs("[data-login-screen]").hidden = true;
    qs("[data-command-shell]").hidden = false;
  }

  function hasUnsavedChanges() { return state.menuDirty || state.plannerDirty; }

  function setActiveView(view, updateHistory = true) {
    if (!views[view]) view = "today";
    state.activeView = view;
    qsa("[data-view]").forEach((section) => { section.hidden = section.dataset.view !== view; });
    qsa("[data-nav]").forEach((button) => {
      button.setAttribute("aria-current", button.dataset.nav === view ? "page" : "false");
    });
    qs("[data-page-eyebrow]").textContent = views[view][0];
    qs("[data-page-title]").textContent = views[view][1];
    if (updateHistory) {
      const url = new URL(location.href);
      if (view === "today") url.searchParams.delete("view");
      else url.searchParams.set("view", view);
      history.replaceState({}, "", url);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function connectionItem(title, detail, status = "good") {
    const item = el("div", `connection-item is-${status}`);
    item.append(el("i"));
    const copy = el("div");
    copy.append(el("strong", "", title), el("small", "", detail));
    item.append(copy);
    return item;
  }

  function renderToday() {
    const live = Boolean(state.location && !state.locationExpired);
    const hero = qs("[data-today-status]");
    hero.classList.toggle("is-live", live);
    qs("[data-today-kicker]").textContent = live ? "Live now" : "Truck status";
    qs("[data-today-title]").textContent = live ? "Big Papa’s is open." : "Ready for the next stop.";
    qs("[data-today-detail]").textContent = live
      ? `${state.location.locationName || "Your live pin is active"}${state.location.hours ? ` · ${state.location.hours}` : ""}. Customers can see the map and order online.`
      : "When you park, drop the pin here and the public site and Facebook Page will update together.";
    qs("[data-today-primary]").textContent = live ? "Manage live stop" : "Go live";
    qs("[data-today-primary]").onclick = () => setActiveView("location");
    qs("[data-header-status]").textContent = live ? "● Live now" : "Ready";

    const next = state.calendar?.events?.[0];
    const nextTarget = qs("[data-next-event]");
    nextTarget.replaceChildren();
    if (!next) {
      nextTarget.append(el("p", "empty-state", state.calendar?.configured ? "No upcoming calendar events are scheduled." : "Connect Google Calendar to show the next stop here."));
    } else {
      const card = el("div", "next-event-card");
      const tile = el("div", "date-tile");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(next.start) ? new Date(`${next.start}T12:00:00`) : new Date(next.start);
      const month = Number.isNaN(date.getTime()) ? "TBD" : new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short" }).format(date);
      const day = Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", day: "numeric" }).format(date);
      tile.append(el("small", "", month), el("strong", "", day));
      const copy = el("div");
      copy.append(el("h3", "", next.title));
      copy.append(el("p", "", `${formatCalendarTime(next)}${next.location ? ` · ${next.location}` : ""}`));
      card.append(tile, copy);
      nextTarget.append(card);
    }

    const menuTarget = qs("[data-today-menu]");
    menuTarget.replaceChildren();
    const products = state.menu?.products?.filter((item) => item.visible) || [];
    const sold = products.filter((item) => !item.available);
    const summary = el("div", "availability-summary");
    summary.append(el("strong", "", sold.length ? String(sold.length) : "✓"), el("span", "", sold.length ? `${sold.length === 1 ? "item is" : "items are"} sold out` : "Everything shown is available"));
    menuTarget.append(summary);
    if (sold.length) {
      const list = el("div", "sold-list");
      sold.forEach((item) => list.append(el("span", "", item.name)));
      menuTarget.append(list);
    }

    const connections = qs("[data-connections]");
    connections.replaceChildren(
      connectionItem("Menu board", state.menu ? "Published and synced across displays" : "Menu data unavailable", state.menu ? "good" : "bad"),
      connectionItem("Google Calendar", state.calendar?.configured ? `${state.calendar.events.length} upcoming event${state.calendar.events.length === 1 ? "" : "s"} loaded` : "Calendar is not connected", state.calendar?.configured ? "good" : "bad"),
      connectionItem("Facebook", state.facebook?.message || "Status unavailable", ["failed", "not_configured"].includes(state.facebook?.state) ? "bad" : state.facebook?.state === "pending" ? "warn" : "good"),
    );
  }

  function hydrateLocationForm() {
    if (!state.location) return;
    qs("[data-location-name]").value = state.location.locationName || "";
    qs("[data-location-hours]").value = state.location.hours || "";
    qs("[data-location-note]").value = state.location.note || "";
    if (!state.coords) state.coords = { latitude: state.location.latitude, longitude: state.location.longitude, accuracy: state.location.accuracy };
  }

  function renderPinPreview() {
    const preview = qs("[data-pin-preview]");
    const button = qs("[data-publish-location]");
    if (!state.coords) {
      preview.hidden = true;
      button.disabled = true;
      return;
    }
    preview.hidden = false;
    qs("[data-pin-accuracy]").textContent = state.coords.accuracy === null || state.coords.accuracy === undefined
      ? "Location captured"
      : `Accuracy: about ${Math.round(state.coords.accuracy * 3.28084)} feet`;
    const map = qs("[data-pin-map]");
    map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${state.coords.latitude},${state.coords.longitude}`)}`;
    button.disabled = false;
  }

  function renderFacebook(targetRoot = document) {
    const facebook = state.facebook || { state: "failed", message: "Facebook status unavailable.", canRetry: true };
    const titleMap = {
      ready: "Connected and ready",
      open: "Live post published",
      closed: "Previous post marked closed",
      pending: "Update in progress",
      failed: "Facebook needs attention",
      not_configured: "Facebook is not connected",
    };
    const dot = qs(".state-dot", targetRoot);
    if (dot) {
      dot.classList.toggle("is-good", ["ready", "open", "closed"].includes(facebook.state));
      dot.classList.toggle("is-bad", ["failed", "not_configured"].includes(facebook.state));
    }
    const title = qs("[data-facebook-title]", targetRoot);
    const detail = qs("[data-facebook-detail]", targetRoot);
    const retry = qs("[data-facebook-retry]", targetRoot);
    if (title) title.textContent = titleMap[facebook.state] || "Facebook status";
    if (detail) detail.textContent = facebook.message || "";
    if (retry) retry.hidden = !facebook.canRetry;
  }

  function renderLocation() {
    const live = Boolean(state.location && !state.locationExpired);
    const mini = qs("[data-location-mini]");
    mini.replaceChildren(el("small", "", live ? "Live stop" : "Current status"), el("strong", "", live ? (state.location.locationName || "Pin is live") : "No active pin"));
    renderPinPreview();
    renderFacebook(qs("[data-location-facebook]"));
    qs("[data-close-location]").disabled = !state.location;
  }

  function markMenuDirty() {
    state.menuDirty = true;
    const button = qs("[data-save-menu]");
    button.disabled = false;
    qs("[data-menu-status]").textContent = "Menu changes are waiting";
    qs("[data-menu-updated]").textContent = "Publish when you are ready.";
    renderToday();
  }

  function createCheck(labelText, checked, onChange) {
    const label = el("label", "check-field");
    const input = el("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    label.append(input, document.createTextNode(labelText));
    return label;
  }

  function createInputField(labelText, value, onInput, options = {}) {
    const label = el("label", options.className || "");
    const input = options.multiline ? el("textarea") : el("input");
    if (!options.multiline) input.type = options.type || "text";
    if (options.min !== undefined) input.min = String(options.min);
    if (options.max !== undefined) input.max = String(options.max);
    if (options.step !== undefined) input.step = String(options.step);
    input.value = value ?? "";
    if (options.placeholder) input.placeholder = options.placeholder;
    input.addEventListener("input", () => onInput(options.number ? number(input.value) : options.optional ? optionalNumber(input.value) : input.value));
    label.append(document.createTextNode(labelText), input);
    return label;
  }

  function renderMenuProducts() {
    const target = qs("[data-command-products]");
    target.replaceChildren();
    for (const product of state.menu?.products || []) {
      const card = el("article", `product-card accent-${product.accent}`);
      const summary = el("div", "product-summary");
      const name = el("div", "product-name");
      name.append(el("small", "", product.visible ? product.eyebrow : "Hidden from menu"), el("strong", "", product.name));
      const price = el("div", "product-price-group");
      price.append(el("span", "product-price", lunchProductPrice(product.price)));
      if (state.menu?.lunchPricing?.enabled === true) price.append(el("small", "", `Regular ${product.price}`));
      const stock = el("button", `stock-toggle${product.available ? "" : " is-sold"}`, product.available ? "In stock" : "Sold out");
      stock.type = "button";
      stock.addEventListener("click", () => { product.available = !product.available; markMenuDirty(); renderMenuProducts(); });
      const edit = el("button", "product-edit-toggle", state.openProducts.has(product.id) ? "Hide details ↑" : "Edit details ↓");
      edit.type = "button";
      edit.addEventListener("click", () => {
        if (state.openProducts.has(product.id)) state.openProducts.delete(product.id); else state.openProducts.add(product.id);
        renderMenuProducts();
      });
      summary.append(name, price, stock, edit);
      card.append(summary);
      if (state.openProducts.has(product.id)) {
        const editor = el("div", "product-editor");
        editor.append(
          createInputField("Name", product.name, (value) => { product.name = value; markMenuDirty(); }, { className: "wide" }),
          createInputField("Price", product.price, (value) => { product.price = value; markMenuDirty(); }),
          createInputField("Category line", product.eyebrow, (value) => { product.eyebrow = value; markMenuDirty(); }),
          createInputField("Description", product.description, (value) => { product.description = value; markMenuDirty(); }, { multiline: true, className: "full" }),
        );
        const accentLabel = el("label");
        const accent = el("select");
        ["red", "blue", "gold"].forEach((value) => { const option = el("option", "", value[0].toUpperCase() + value.slice(1)); option.value = value; option.selected = product.accent === value; accent.append(option); });
        accent.addEventListener("change", () => { product.accent = accent.value; markMenuDirty(); renderMenuProducts(); });
        accentLabel.append(document.createTextNode("Accent"), accent);
        editor.append(accentLabel, createCheck("Show on menu", product.visible, (value) => { product.visible = value; markMenuDirty(); renderMenuProducts(); }), createCheck("Show NEW badge", product.isNew, (value) => { product.isNew = value; markMenuDirty(); }));
        card.append(editor);
      }
      target.append(card);
    }
  }

  function smallMenuSection(title, items) {
    const section = el("section", "small-menu-section");
    section.append(el("h3", "", title));
    items.forEach((item) => {
      const row = el("div", "small-editor-row");
      row.append(
        createInputField("Name", item.name, (value) => { item.name = value; markMenuDirty(); }),
        createInputField("Price", item.price, (value) => { item.price = value; markMenuDirty(); }),
        createCheck("Available", item.available, (value) => { item.available = value; markMenuDirty(); renderToday(); }),
        createCheck("Show", item.visible, (value) => { item.visible = value; markMenuDirty(); }),
      );
      section.append(row);
    });
    return section;
  }

  function renderSmallMenuEditor() {
    const target = qs("[data-small-menu-editor]");
    target.replaceChildren();
    if (!state.menu) return;
    target.append(smallMenuSection("Add-ons", state.menu.addOns), smallMenuSection("Drinks", state.menu.drinks));
    const combo = el("section", "small-menu-section");
    combo.append(el("h3", "", "Combo"));
    const row = el("div", "small-editor-row");
    row.append(
      createInputField("Label", state.menu.combo.label, (value) => { state.menu.combo.label = value; markMenuDirty(); }),
      createInputField("Price", state.menu.combo.price, (value) => { state.menu.combo.price = value; markMenuDirty(); }),
      createCheck("Enabled", state.menu.combo.enabled, (value) => { state.menu.combo.enabled = value; markMenuDirty(); }),
    );
    combo.append(row, createInputField("Description", state.menu.combo.description, (value) => { state.menu.combo.description = value; markMenuDirty(); }, { className: "full" }));
    target.append(combo);
  }

  function renderDrinksControl() {
    const input = qs("[data-drinks-enabled]");
    const status = qs("[data-drinks-status]");
    if (!input || !status || !state.menu) return;
    const enabled = state.menu.drinksEnabled !== false;
    input.checked = enabled;
    status.textContent = enabled ? "Drinks shown" : "Drinks hidden";
    status.classList.toggle("is-hidden", !enabled);
  }

  function renderLunchPricingControl(options = {}) {
    const enabledInput = qs("[data-lunch-enabled]");
    const reductionInput = qs("[data-lunch-reduction]");
    const status = qs("[data-lunch-status]");
    if (!enabledInput || !reductionInput || !status || !state.menu) return;
    const enabled = state.menu.lunchPricing?.enabled === true;
    const reduction = state.menu.lunchPricing?.reduction ?? "$0.00";
    enabledInput.checked = enabled;
    if (!options.keepReductionInput) reductionInput.value = (priceInCents(reduction) / 100).toFixed(2);
    status.textContent = enabled ? `Lunch prices on · $${(priceInCents(reduction) / 100).toFixed(2)} less` : "Regular prices";
    status.classList.toggle("is-hidden", !enabled);
  }

  function renderMenu() {
    if (!state.menu) return;
    qs("[data-menu-announcement]").value = state.menu.board.announcement || "";
    qs("[data-menu-speed]").value = String(state.menu.board.announcementSpeed || 65);
    qs("[data-speed-output]").value = speedLabel(state.menu.board.announcementSpeed);
    qs("[data-menu-status]").textContent = state.menuDirty ? "Menu changes are waiting" : "Menu is published";
    qs("[data-menu-updated]").textContent = state.menuDirty ? "Publish when you are ready." : `Last updated ${formatDateTime(state.menu.updatedAt)}`;
    qs("[data-save-menu]").disabled = !state.menuDirty;
    renderLunchPricingControl();
    renderDrinksControl();
    renderMenuProducts();
    renderSmallMenuEditor();
  }

  function activeEvent() {
    return state.planner?.events?.find((event) => event.id === state.activeEventId) || null;
  }

  function eventForecast(event) {
    const expectedOrders = Math.ceil(number(event.attendance) * (number(event.captureRate) / 100));
    const prepTarget = Math.ceil(expectedOrders * (1 + number(event.bufferRate) / 100));
    const serviceMinutes = minutesBetween(event.openTime, event.closeTime);
    const hours = Math.max(.25, serviceMinutes / 60);
    const hourlyDemand = expectedOrders / hours;
    const ovenRate = number(event.batchSize, 1) * 60 / Math.max(1, number(event.cycleMinutes, 1));
    const cycles = Math.max(0, Math.floor(serviceMinutes / Math.max(1, number(event.cycleMinutes, 1))));
    const serviceCapacity = number(event.openingReady) + cycles * number(event.batchSize);
    return { expectedOrders, prepTarget, serviceMinutes, hourlyDemand, ovenRate, serviceCapacity };
  }

  function minutes(time) {
    const [hour, minute] = String(time || "00:00").split(":").map(Number);
    return hour * 60 + minute;
  }

  function minutesBetween(start, end) {
    let value = minutes(end) - minutes(start);
    if (value <= 0) value += 1440;
    return value;
  }

  function timeAt(base, offset) {
    let total = (minutes(base) + offset) % 1440;
    if (total < 0) total += 1440;
    const date = new Date(2020, 0, 1, Math.floor(total / 60), total % 60);
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function markPlannerDirty() {
    state.plannerDirty = true;
    qs("[data-save-events]").disabled = false;
    qs("[data-event-save-status]").textContent = "Unsaved event changes";
    renderReports();
  }

  function renderEventList() {
    const target = qs("[data-command-event-list]");
    target.replaceChildren();
    const events = state.planner?.events || [];
    if (!events.length) {
      target.append(el("p", "empty-state", "No event plans yet. Start a new event or use the 2590 template."));
      return;
    }
    [...events].sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate))).forEach((event) => {
      const button = el("button");
      button.type = "button";
      button.setAttribute("aria-current", String(event.id === state.activeEventId));
      button.append(el("strong", "", event.name), el("small", "", `${formatDate(event.eventDate)}${event.location ? ` · ${event.location}` : ""}`));
      button.addEventListener("click", () => { state.activeEventId = event.id; renderEvents(); });
      target.append(button);
    });
  }

  function renderEventFields(event) {
    const target = qs("[data-event-fields]");
    target.replaceChildren();
    const field = (label, key, options = {}) => createInputField(label, event[key], (value) => {
      event[key] = value;
      markPlannerDirty();
      qs("[data-active-event-name]").textContent = event.name || "Untitled event";
      if (options.recalculate) renderEventCalculations(event);
      renderEventList();
    }, options);
    target.append(
      field("Event name", "name", { className: "wide" }),
      field("Location", "location", { className: "wide" }),
      field("Event date", "eventDate", { type: "date" }),
      field("Setup time", "setupTime", { type: "time", recalculate: true }),
      field("Open time", "openTime", { type: "time", recalculate: true }),
      field("Close time", "closeTime", { type: "time", recalculate: true }),
      field("Expected attendance", "attendance", { type: "number", min: 0, number: true, recalculate: true }),
      field("Capture rate %", "captureRate", { type: "number", min: 0, max: 100, step: .1, number: true, recalculate: true }),
      field("Prep buffer %", "bufferRate", { type: "number", min: 0, max: 100, step: .1, number: true, recalculate: true }),
      field("Crew count", "crewCount", { type: "number", min: 1, number: true }),
      field("Notes", "notes", { multiline: true, className: "full" }),
    );
  }

  function forecastCard(label, value, detail, alert = false) {
    const card = el("article", `forecast-card${alert ? " is-alert" : ""}`);
    card.append(el("small", "", label), el("strong", "", value), el("span", "", detail));
    return card;
  }

  function renderForecast(event) {
    const data = eventForecast(event);
    const target = qs("[data-event-forecast]");
    const over = data.hourlyDemand > data.ovenRate;
    target.replaceChildren(
      forecastCard("Expected orders", String(data.expectedOrders), `${number(event.attendance).toLocaleString()} people × ${number(event.captureRate)}%`),
      forecastCard("Prep target", String(data.prepTarget), `${number(event.bufferRate)}% safety buffer`),
      forecastCard("Required pace", `${data.hourlyDemand.toFixed(1)}/hr`, `${(data.hourlyDemand / 4).toFixed(1)} sales every 15 min`, over),
      forecastCard("Oven pace", `${data.ovenRate.toFixed(1)}/hr`, `${event.batchSize} every ${event.cycleMinutes} min`, over),
    );
  }

  function renderMix(event) {
    const target = qs("[data-event-mix]");
    target.replaceChildren();
    const prepTarget = eventForecast(event).prepTarget;
    event.menu.forEach((item) => {
      const row = el("div", "mix-row");
      row.append(el("strong", "", item.name));
      const label = el("label", "", "Sales mix %");
      const input = el("input");
      input.type = "number"; input.min = "0"; input.max = "100"; input.step = ".1"; input.value = item.mix;
      const count = el("output", "", String(Math.round(prepTarget * number(item.mix) / 100)));
      input.addEventListener("input", () => {
        item.mix = number(input.value);
        count.value = String(Math.round(eventForecast(event).prepTarget * item.mix / 100));
        markPlannerDirty();
        updateMixTotal(event, target);
      });
      label.append(input);
      row.append(label, count);
      target.append(row);
    });
    const total = el("div", "mix-total");
    total.dataset.mixTotal = "";
    target.append(total);
    updateMixTotal(event, target);
  }

  function updateMixTotal(event, target) {
    const totalValue = event.menu.reduce((sum, item) => sum + number(item.mix), 0);
    const total = qs("[data-mix-total]", target);
    if (!total) return;
    const valid = Math.abs(totalValue - 100) <= .05;
    total.textContent = `Mix total: ${totalValue.toFixed(1)}%${valid ? " ✓" : " — adjust to 100%"}`;
    total.classList.toggle("is-error", !valid);
  }

  function renderOven(event) {
    const target = qs("[data-oven-fields]");
    target.replaceChildren();
    [["Batch size", "batchSize"], ["Cycle minutes", "cycleMinutes"], ["Ready at open", "openingReady"], ["Cooking at open", "openingCooking"]].forEach(([label, key]) => {
      target.append(createInputField(label, event[key], (value) => { event[key] = value; markPlannerDirty(); renderForecast(event); renderTimeline(event); }, { type: "number", min: key === "cycleMinutes" || key === "batchSize" ? 1 : 0, number: true }));
    });
  }

  function renderTimeline(event) {
    const list = qs("[data-event-timeline]");
    const cycle = Math.max(1, number(event.cycleMinutes, 55));
    const batch = Math.max(1, number(event.batchSize, 30));
    const readyBatches = Math.max(1, Math.ceil(number(event.openingReady) / batch));
    const cookingBatches = Math.max(1, Math.ceil(number(event.openingCooking) / batch));
    const firstReadyEnd = 5 - cookingBatches * cycle;
    const firstReadyStart = firstReadyEnd - ((readyBatches - 1) * cycle) - cycle;
    const steps = [
      [firstReadyStart - 95, "Preheat & preflight", "Power, water, pans, thermometers, warmer and service line."],
      [firstReadyStart - 90, "Reheat hot toppings", "Bring hot toppings to 165°F, then hold at 135°F or above."],
      [firstReadyStart - 5, "Clear the combi", "Protect the oven for potato production."],
    ];
    for (let index = 0; index < readyBatches; index += 1) {
      const offset = firstReadyStart + index * cycle;
      steps.push([offset, `Load opening batch ${index + 1}`, `${batch} potatoes · unload around ${timeAt(event.openTime, offset + cycle)}.`]);
    }
    steps.push(
      [minutes(event.setupTime) - minutes(event.openTime), "Event setup", "Build the line, verify labels, FIFO order and packaging."],
      [5 - cycle, "Load first service batch", `${event.openingCooking} cooking at open; expected out around ${timeAt(event.openTime, 5)}.`],
      [-10, "Opening verification", "Check ready count, center temperatures, hot holds and roles."],
      [0, "Open for service", "Sell the oldest verified batch first and begin 15-minute pace calls."],
    );
    steps.sort((a, b) => a[0] - b[0]);
    list.replaceChildren(...steps.map(([offset, title, detail]) => {
      const item = el("li");
      item.append(el("time", "", timeAt(event.openTime, offset)), el("strong", "", title), el("p", "", detail));
      return item;
    }));
  }

  const logTypes = {
    pace: { title: "15-minute pace calls", headers: ["Time", "Sold", "Ready", "Cooking", "Next batch"], inputTypes: ["time", "number", "number", "number", "time"] },
    production: { title: "Production log", headers: ["Batch", "Loaded", "Unloaded", "Quantity", "Initials"], inputTypes: ["text", "time", "time", "number", "text"] },
    temp: { title: "Temperature log", headers: ["Time", "Item", "Temperature", "Action", "Initials"], inputTypes: ["time", "text", "text", "text", "text"] },
  };

  function renderShiftLog(event) {
    const target = qs("[data-shift-log]");
    target.replaceChildren();
    Object.entries(logTypes).forEach(([type, config]) => {
      const key = `${type}Log`;
      if (!Array.isArray(event[key])) event[key] = [];
      const section = el("section", "log-section");
      const heading = el("div", "log-heading");
      const add = el("button", "", "+ Add row");
      add.type = "button";
      add.addEventListener("click", () => { event[key].push(["", "", "", "", ""]); markPlannerDirty(); renderShiftLog(event); });
      heading.append(el("h3", "", config.title), add);
      const scroll = el("div", "log-scroll");
      const table = el("table", "log-table");
      const thead = el("thead"); const headRow = el("tr");
      config.headers.forEach((header) => headRow.append(el("th", "", header)));
      headRow.append(el("th", "", "")); thead.append(headRow);
      const tbody = el("tbody");
      event[key].forEach((values, rowIndex) => {
        const row = el("tr");
        config.inputTypes.forEach((inputType, columnIndex) => {
          const cell = el("td"); const input = el("input");
          input.type = inputType; if (inputType === "number") input.min = "0";
          input.value = values[columnIndex] || "";
          input.addEventListener("input", () => { event[key][rowIndex][columnIndex] = input.value; markPlannerDirty(); });
          cell.append(input); row.append(cell);
        });
        const deleteCell = el("td"); const remove = el("button", "", "×"); remove.type = "button";
        remove.addEventListener("click", () => { event[key].splice(rowIndex, 1); markPlannerDirty(); renderShiftLog(event); });
        deleteCell.append(remove); row.append(deleteCell); tbody.append(row);
      });
      table.append(thead, tbody); scroll.append(table); section.append(heading, scroll); target.append(section);
    });
  }

  function renderReview(event) {
    const form = qs("[data-review-fields]");
    form.replaceChildren();
    const update = (key, value) => { event[key] = value; markPlannerDirty(); renderReviewCards(event); };
    form.append(
      createInputField("Actual orders", event.actualOrders, (value) => update("actualOrders", value), { type: "number", min: 0, optional: true }),
      createInputField("Waste / discard", event.actualWaste, (value) => update("actualWaste", value), { type: "number", min: 0, optional: true }),
      createInputField("Peak 15-minute sales", event.peakFifteen, (value) => update("peakFifteen", value), { type: "number", min: 0, optional: true }),
      createInputField("What should we change next time?", event.reviewNotes, (value) => { event.reviewNotes = value; markPlannerDirty(); }, { multiline: true, className: "full" }),
    );
    renderReviewCards(event);
  }

  function renderReviewCards(event) {
    const target = qs("[data-event-review]");
    const forecast = eventForecast(event).expectedOrders;
    const actual = event.actualOrders;
    const variance = actual === null ? null : actual - forecast;
    const capture = actual === null || !number(event.attendance) ? null : actual / number(event.attendance) * 100;
    const wasteRate = actual === null || event.actualWaste === null ? null : number(event.actualWaste) / Math.max(1, number(actual) + number(event.actualWaste)) * 100;
    target.replaceChildren(
      reviewCard("Forecast variance", variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance}`, variance === null ? "Enter actual orders" : `${forecast} forecast vs ${actual} actual`),
      reviewCard("Actual capture", capture === null ? "—" : `${capture.toFixed(1)}%`, capture === null ? "Enter actual orders" : `${event.attendance} attendance`),
      reviewCard("Waste rate", wasteRate === null ? "—" : `${wasteRate.toFixed(1)}%`, wasteRate === null ? "Enter waste" : `${event.actualWaste} units recorded`),
    );
  }

  function reviewCard(label, value, detail) {
    const card = el("article", "review-card");
    card.append(el("small", "", label), el("strong", "", value), el("span", "", detail));
    return card;
  }

  function renderEventCalculations(event) {
    renderForecast(event);
    renderMix(event);
    renderOven(event);
    renderTimeline(event);
    renderShiftLog(event);
    renderReview(event);
  }

  function renderEvents() {
    renderEventList();
    const event = activeEvent();
    const workspace = qs("[data-event-workspace]");
    if (!event) {
      workspace.hidden = true;
      return;
    }
    workspace.hidden = false;
    qs("[data-active-event-name]").textContent = event.name || "Untitled event";
    renderEventFields(event);
    renderEventCalculations(event);
    qs("[data-save-events]").disabled = !state.plannerDirty;
    qs("[data-event-save-status]").textContent = state.plannerDirty ? "Unsaved event changes" : "Everything is saved.";
  }

  function renderMarketing() {
    const facebook = state.facebook || { state: "failed", message: "Facebook status unavailable." };
    const target = qs("[data-marketing-facebook]");
    target.replaceChildren();
    target.append(el("p", "eyebrow", "Facebook Page"), el("h3", "", ["failed", "not_configured"].includes(facebook.state) ? "Connection needs attention" : "Connected and working"));
    const badge = el("span", `health-badge${["failed", "not_configured"].includes(facebook.state) ? " is-bad" : ""}`, ["failed", "not_configured"].includes(facebook.state) ? "● Check connection" : "● Automation ready");
    target.append(badge, el("p", "", facebook.message || ""));
    if (facebook.canRetry) {
      const retry = el("button", "outline-link", "Retry Facebook"); retry.type = "button"; retry.addEventListener("click", retryFacebook); target.append(retry);
    }

    qs("[data-calendar-sync]").textContent = state.calendar?.configured ? `Synced ${formatDateTime(state.refreshedAt)}` : "Not connected";
    const calendarTarget = qs("[data-command-calendar]");
    calendarTarget.replaceChildren();
    const events = state.calendar?.events || [];
    if (!events.length) {
      calendarTarget.append(el("p", "empty-state", state.calendar?.configured ? "No upcoming events are scheduled." : "Google Calendar is not connected."));
      return;
    }
    events.forEach((event) => {
      const row = el("article", "calendar-row");
      const tile = el("div", "date-tile");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(event.start) ? new Date(`${event.start}T12:00:00`) : new Date(event.start);
      tile.append(el("small", "", Number.isNaN(date.getTime()) ? "TBD" : new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short" }).format(date)), el("strong", "", Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", day: "numeric" }).format(date)));
      const copy = el("div"); copy.append(el("h3", "", event.title), el("p", "", `${formatCalendarTime(event)}${event.location ? ` · ${event.location}` : ""}`));
      row.append(tile, copy);
      if (event.detailsUrl) { const link = el("a", "", `${event.detailsLabel || "Details"} ↗`); link.href = event.detailsUrl; link.target = "_blank"; link.rel = "noreferrer noopener"; row.append(link); }
      calendarTarget.append(row);
    });
  }

  function reportStat(label, value, detail) {
    const card = el("article", "report-stat");
    card.append(el("small", "", label), el("strong", "", value), el("span", "", detail));
    return card;
  }

  function renderReports() {
    const completed = (state.planner?.events || []).filter((event) => event.actualOrders !== null);
    const summary = qs("[data-report-summary]");
    const tableTarget = qs("[data-report-table]");
    summary.replaceChildren(); tableTarget.replaceChildren();
    if (!completed.length) {
      summary.append(reportStat("Completed events", "0", "Add actual sales in an event review"), reportStat("Actual capture", "—", "Waiting for results"), reportStat("Waste recorded", "—", "Waiting for results"));
      tableTarget.append(el("p", "empty-state", "When you finish an event, enter actual sales and waste. Results will build automatically here."));
      return;
    }
    const actualTotal = completed.reduce((sum, event) => sum + number(event.actualOrders), 0);
    const attendanceTotal = completed.reduce((sum, event) => sum + number(event.attendance), 0);
    const wasteTotal = completed.reduce((sum, event) => sum + number(event.actualWaste), 0);
    summary.append(
      reportStat("Completed events", String(completed.length), "Events with actual sales entered"),
      reportStat("Actual capture", attendanceTotal ? `${(actualTotal / attendanceTotal * 100).toFixed(1)}%` : "—", `${actualTotal.toLocaleString()} total orders`),
      reportStat("Waste recorded", wasteTotal.toLocaleString(), "Total units across completed events"),
    );
    const table = el("table");
    const head = el("thead"); const headRow = el("tr");
    ["Event", "Date", "Forecast", "Actual", "Variance", "Capture", "Waste"].forEach((label) => headRow.append(el("th", "", label)));
    head.append(headRow);
    const body = el("tbody");
    [...completed].sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate))).forEach((event) => {
      const forecast = eventForecast(event).expectedOrders;
      const variance = number(event.actualOrders) - forecast;
      const capture = number(event.attendance) ? number(event.actualOrders) / number(event.attendance) * 100 : null;
      const row = el("tr");
      const nameCell = el("td"); nameCell.append(el("strong", "", event.name));
      row.append(nameCell, el("td", "", formatDate(event.eventDate)), el("td", "", String(forecast)), el("td", "", String(event.actualOrders)), el("td", variance >= 0 ? "variance-good" : "variance-bad", `${variance > 0 ? "+" : ""}${variance}`), el("td", "", capture === null ? "—" : `${capture.toFixed(1)}%`), el("td", "", event.actualWaste === null ? "—" : String(event.actualWaste)));
      body.append(row);
    });
    table.append(head, body); tableTarget.append(table);
  }

  function renderAll() {
    renderToday();
    renderLocation();
    renderMenu();
    renderEvents();
    renderMarketing();
    renderReports();
    qs("[data-refreshed]").textContent = `Updated ${formatDateTime(state.refreshedAt)}`;
    setActiveView(state.activeView, false);
  }

  async function loadOverview({ preserveMessage = false } = {}) {
    if (!preserveMessage) globalMessage();
    const refresh = qs("[data-refresh]");
    busy(refresh, true, "Refreshing…");
    try {
      const { response, result } = await api("/api/command/overview");
      if (response.status === 401) return showLogin();
      if (!response.ok) throw new Error(result.message || "Could not load the Command Center.");
      state.location = result.location;
      state.locationExpired = Boolean(result.locationExpired);
      state.facebook = result.facebook;
      state.menu = result.menu;
      state.planner = result.planner;
      state.calendar = result.calendar || { configured: false, events: [] };
      state.refreshedAt = result.refreshedAt || new Date().toISOString();
      if (!state.activeEventId || !state.planner?.events?.some((event) => event.id === state.activeEventId)) state.activeEventId = state.planner?.events?.[0]?.id || null;
      state.menuDirty = false;
      state.plannerDirty = false;
      hydrateLocationForm();
      showCommandCenter();
      renderAll();
      if (reviewMode) globalMessage("Review mode — try anything you like here. Publish and save actions stay inside this preview and will not change the live site.");
    } catch (error) {
      showLogin(error.message || "Could not connect to the Command Center.", "error");
    } finally {
      busy(refresh, false);
    }
  }

  async function captureLocation() {
    const button = qs("[data-locate]");
    setMessage("[data-location-message]");
    if (!navigator.geolocation) return setMessage("[data-location-message]", "This device cannot capture a location.", "error");
    busy(button, true, "Finding the trailer…");
    navigator.geolocation.getCurrentPosition((position) => {
      state.coords = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
      busy(button, false);
      setMessage("[data-location-message]", "Pin captured. Add the stop details, then publish.", "success");
      renderPinPreview();
    }, (error) => {
      busy(button, false);
      const text = error.code === 1 ? "Location access was blocked. Allow location access in the browser and try again." : "We could not capture the location. Move where the phone has a clear signal and try again.";
      setMessage("[data-location-message]", text, "error");
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  }

  async function publishLocation() {
    if (!state.coords) return setMessage("[data-publish-message]", "Capture the pin first.", "error");
    const button = qs("[data-publish-location]");
    busy(button, true, "Publishing…");
    setMessage("[data-publish-message]");
    if (reviewMode) {
      const now = new Date();
      state.location = {
        live: true,
        latitude: state.coords.latitude,
        longitude: state.coords.longitude,
        accuracy: state.coords.accuracy,
        locationName: qs("[data-location-name]").value,
        hours: qs("[data-location-hours]").value,
        note: qs("[data-location-note]").value,
        updatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + number(qs("[data-location-expiration]").value, 8) * 3_600_000).toISOString(),
      };
      state.locationExpired = false;
      setMessage("[data-publish-message]", "Preview successful — the real website and Facebook Page were not changed.", "success");
      busy(button, false);
      renderToday(); renderLocation();
      return;
    }
    try {
      const { response, result } = await api("/api/location/manage", { method: "POST", body: JSON.stringify({
        action: "publish",
        latitude: state.coords.latitude,
        longitude: state.coords.longitude,
        accuracy: state.coords.accuracy,
        locationName: qs("[data-location-name]").value,
        hours: qs("[data-location-hours]").value,
        expiresHours: number(qs("[data-location-expiration]").value, 8),
        note: qs("[data-location-note]").value,
      }) });
      if (response.status === 401) return showLogin("Your session expired. Sign in again.", "error");
      if (!response.ok) throw new Error(result.message || "Could not publish the live location.");
      state.location = result.location;
      state.locationExpired = false;
      state.facebook = result.facebook;
      state.refreshedAt = new Date().toISOString();
      setMessage("[data-publish-message]", "You are live. The public site has been updated.", "success");
      renderToday(); renderLocation(); renderMarketing();
    } catch (error) { setMessage("[data-publish-message]", error.message || "Could not publish.", "error"); }
    finally { busy(button, false); renderPinPreview(); }
  }

  async function closeLocation() {
    if (state.location && !window.confirm("Mark this stop closed, remove the live pin, and update Facebook?")) return;
    const button = qs("[data-close-location]"); busy(button, true, "Closing stop…"); setMessage("[data-publish-message]");
    if (reviewMode) {
      state.location = null; state.locationExpired = false; state.coords = null;
      setMessage("[data-publish-message]", "Preview closed — the real live pin and Facebook Page were not changed.", "success");
      busy(button, false); renderToday(); renderLocation();
      return;
    }
    try {
      const { response, result } = await api("/api/location/manage", { method: "POST", body: JSON.stringify({ action: "clear" }) });
      if (!response.ok) throw new Error(result.message || "Could not close the stop.");
      state.location = null; state.locationExpired = false; state.facebook = result.facebook; state.coords = null; state.refreshedAt = new Date().toISOString();
      setMessage("[data-publish-message]", "The pin is removed and the stop is closed.", "success");
      renderToday(); renderLocation(); renderMarketing();
    } catch (error) { setMessage("[data-publish-message]", error.message || "Could not close the stop.", "error"); }
    finally { busy(button, false); }
  }

  async function retryFacebook() {
    if (reviewMode) {
      globalMessage("Facebook retry previewed. No post or live automation was changed.");
      return;
    }
    const confirmedNoPost = state.facebook?.requiresConfirmation
      ? window.confirm("Facebook could not confirm whether the last post succeeded. Check the Page first. Press OK only if no post exists.")
      : false;
    if (state.facebook?.requiresConfirmation && !confirmedNoPost) return;
    const buttons = qsa("[data-facebook-retry]"); buttons.forEach((button) => busy(button, true, "Retrying…"));
    try {
      const { response, result } = await api("/api/location/manage", { method: "POST", body: JSON.stringify({ action: "retryFacebook", confirmedNoPost }) });
      if (!response.ok) throw new Error(result.message || "Facebook could not be retried.");
      state.facebook = result.facebook; state.location = result.location; state.locationExpired = Boolean(result.expired); renderToday(); renderLocation(); renderMarketing();
      globalMessage("Facebook has been checked again.");
    } catch (error) { globalMessage(error.message || "Facebook retry failed.", "error"); }
    finally { buttons.forEach((button) => busy(button, false)); }
  }

  async function saveMenu() {
    if (!state.menuDirty) return;
    const button = qs("[data-save-menu]"); busy(button, true, "Publishing…");
    if (reviewMode) {
      state.menuDirty = false; state.menu.updatedAt = new Date().toISOString();
      busy(button, false); renderMenu(); renderToday();
      globalMessage("Menu preview saved for this screen only. The live menu and TV board were not changed.");
      return;
    }
    try {
      const { response, result } = await api("/api/menu/manage", { method: "POST", body: JSON.stringify({ action: "save", expectedRevision: state.menu.revision, menu: state.menu }) });
      if (response.status === 401) return showLogin("Your session expired. Sign in again.", "error");
      if (!response.ok) throw new Error(result.message || "Could not publish the menu.");
      state.menu = result.menu; state.menuDirty = false; state.refreshedAt = new Date().toISOString(); renderMenu(); renderToday(); globalMessage("Menu published. The menu board and public website will update automatically.");
    } catch (error) { globalMessage(error.message || "Could not publish the menu.", "error"); }
    finally { busy(button, false); button.disabled = !state.menuDirty; }
  }

  async function requestEventTemplate(kind) {
    try {
      const { response, result } = await api("/api/event-planner/manage", { method: "POST", body: JSON.stringify({ action: "template", template: kind }) });
      if (!response.ok) throw new Error(result.message || "Could not create the event.");
      const event = result.event;
      event.id = `${event.id}-${Date.now().toString(36)}`;
      state.planner.events.unshift(event); state.activeEventId = event.id; markPlannerDirty(); renderEvents();
    } catch (error) { globalMessage(error.message || "Could not create the event.", "error"); }
  }

  function duplicateEvent() {
    const source = activeEvent(); if (!source) return;
    const copy = deepClone(source); copy.id = `event-${Date.now().toString(36)}`; copy.name = `${source.name} copy`; copy.actualOrders = null; copy.actualWaste = null; copy.peakFifteen = null; copy.reviewNotes = ""; copy.paceLog = []; copy.productionLog = []; copy.tempLog = [];
    copy.menu.forEach((item) => { item.actualSold = null; item.leftover = null; });
    state.planner.events.unshift(copy); state.activeEventId = copy.id; markPlannerDirty(); renderEvents();
  }

  function deleteEvent() {
    const event = activeEvent(); if (!event || !window.confirm(`Delete “${event.name}”?`)) return;
    state.planner.events = state.planner.events.filter((candidate) => candidate.id !== event.id); state.activeEventId = state.planner.events[0]?.id || null; markPlannerDirty(); renderEvents();
  }

  async function saveEvents() {
    if (!state.plannerDirty) return;
    const button = qs("[data-save-events]"); busy(button, true, "Saving…");
    if (reviewMode) {
      state.plannerDirty = false; state.planner.updatedAt = new Date().toISOString();
      busy(button, false); renderEvents(); renderReports();
      globalMessage("Event plan preview saved for this screen only. Your real event plans were not changed.");
      return;
    }
    try {
      const { response, result } = await api("/api/event-planner/manage", { method: "POST", body: JSON.stringify({ action: "save", expectedRevision: state.planner.revision, planner: state.planner }) });
      if (response.status === 401) return showLogin("Your session expired. Sign in again.", "error");
      if (!response.ok) throw new Error(result.message || "Could not save the event plans.");
      state.planner = result.planner; state.plannerDirty = false; state.refreshedAt = new Date().toISOString(); renderEvents(); renderReports(); globalMessage("Event plans saved. They are available on every device.");
    } catch (error) { globalMessage(error.message || "Could not save the events.", "error"); }
    finally { busy(button, false); button.disabled = !state.plannerDirty; }
  }

  async function logout() {
    if (hasUnsavedChanges() && !window.confirm("Sign out and discard unsaved changes?")) return;
    await api("/api/location/manage", { method: "POST", body: JSON.stringify({ action: "logout" }) });
    state.location = null; state.menu = null; state.planner = null; state.coords = null; showLogin("Signed out.", "success");
  }

  function bindEvents() {
    qsa("[data-nav]").forEach((button) => button.addEventListener("click", () => setActiveView(button.dataset.nav)));
    qsa("[data-go]").forEach((button) => button.addEventListener("click", () => setActiveView(button.dataset.go)));
    qsa("[data-logout]").forEach((button) => button.addEventListener("click", logout));
    qs("[data-refresh]")?.addEventListener("click", () => {
      if (hasUnsavedChanges() && !window.confirm("Refresh and discard unsaved changes?")) return;
      loadOverview();
    });
    qs("[data-locate]")?.addEventListener("click", captureLocation);
    qs("[data-publish-location]")?.addEventListener("click", publishLocation);
    qs("[data-close-location]")?.addEventListener("click", closeLocation);
    qs("[data-facebook-retry]")?.addEventListener("click", retryFacebook);
    qs("[data-save-menu]")?.addEventListener("click", saveMenu);
    qs("[data-menu-announcement]")?.addEventListener("input", (event) => { if (!state.menu) return; state.menu.board.announcement = event.target.value; markMenuDirty(); });
    qs("[data-menu-speed]")?.addEventListener("input", (event) => { if (!state.menu) return; state.menu.board.announcementSpeed = number(event.target.value, 65); qs("[data-speed-output]").value = speedLabel(event.target.value); markMenuDirty(); });
    qs("[data-lunch-enabled]")?.addEventListener("change", (event) => {
      if (!state.menu) return;
      state.menu.lunchPricing ||= { enabled: false, reduction: "$0.00" };
      state.menu.lunchPricing.enabled = event.target.checked;
      renderLunchPricingControl({ keepReductionInput: true });
      renderMenuProducts();
      markMenuDirty();
    });
    qs("[data-lunch-reduction]")?.addEventListener("input", (event) => {
      if (!state.menu) return;
      state.menu.lunchPricing ||= { enabled: false, reduction: "$0.00" };
      state.menu.lunchPricing.reduction = event.target.value;
      renderLunchPricingControl({ keepReductionInput: true });
      renderMenuProducts();
      markMenuDirty();
    });
    qs("[data-drinks-enabled]")?.addEventListener("change", (event) => {
      if (!state.menu) return;
      state.menu.drinksEnabled = event.target.checked;
      renderDrinksControl();
      markMenuDirty();
    });
    qs("[data-new-event]")?.addEventListener("click", () => requestEventTemplate("blank"));
    qs("[data-template-event]")?.addEventListener("click", () => requestEventTemplate("2590"));
    qs("[data-duplicate-event]")?.addEventListener("click", duplicateEvent);
    qs("[data-delete-event]")?.addEventListener("click", deleteEvent);
    qs("[data-save-events]")?.addEventListener("click", saveEvents);
    qs("[data-print-event]")?.addEventListener("click", () => window.print());
    qs("[data-login-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = qs("button", form); const password = new FormData(form).get("password");
      busy(button, true, "Signing in…"); setMessage("[data-login-message]");
      try {
        const { response, result } = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
        if (!response.ok) throw new Error(result.message || "Sign-in failed.");
        form.reset(); await loadOverview();
      } catch (error) { setMessage("[data-login-message]", error.message || "Could not sign in.", "error"); }
      finally { busy(button, false); }
    });
    window.addEventListener("beforeunload", (event) => { if (!hasUnsavedChanges()) return; event.preventDefault(); event.returnValue = ""; });
  }

  bindEvents();
  setActiveView(state.activeView, false);
  loadOverview();
})();
