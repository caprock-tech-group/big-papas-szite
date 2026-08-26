(() => {
  "use strict";

  const loginPanel = document.querySelector("[data-login-panel]");
  const loginForm = document.querySelector("[data-login-form]");
  const loginMessage = document.querySelector("[data-login-message]");
  const app = document.querySelector("[data-app]");
  const eventList = document.querySelector("[data-event-list]");
  const saveButton = document.querySelector("[data-save]");
  const saveState = document.querySelector("[data-save-state]");
  const eventTitle = document.querySelector("[data-event-title]");
  if (!loginPanel || !app || !eventList) return;

  let planner = null;
  let activeId = null;
  let dirty = false;

  const fieldElements = [...document.querySelectorAll("[data-field]")];

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
    let result = {};
    try { result = await response.json(); } catch { result = {}; }
    return { response, result };
  }

  function message(element, text = "", type = "") {
    if (!element) return;
    element.textContent = text;
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
  }

  function busy(button, value, label) {
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = value;
    button.textContent = value ? label : button.dataset.label;
  }

  function activeEvent() { return planner?.events?.find((event) => event.id === activeId) || null; }
  function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  function optionalNumber(value) { return value === "" || value === null || value === undefined ? null : number(value, null); }
  function roundUp(value, multiple = 1) { return Math.ceil(value / multiple) * multiple; }

  function markDirty() {
    if (!planner) return;
    dirty = true;
    saveButton.disabled = false;
    message(saveState, "Unsaved changes", "error");
  }

  function setClean(text = "Everything is saved.") {
    dirty = false;
    saveButton.disabled = true;
    message(saveState, text, "success");
  }

  function dateLabel(event) {
    const date = new Date(`${event.eventDate}T12:00:00`);
    return Number.isNaN(date.getTime()) ? "Date not set" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function renderEventList() {
    eventList.replaceChildren();
    for (const event of planner.events) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-current", String(event.id === activeId));
      const strong = document.createElement("strong");
      const small = document.createElement("small");
      strong.textContent = event.name;
      small.textContent = `${dateLabel(event)}${event.location ? ` · ${event.location}` : ""}`;
      button.append(strong, small);
      button.addEventListener("click", () => selectEvent(event.id));
      eventList.append(button);
    }
    if (!planner.events.length) {
      const empty = document.createElement("p");
      empty.textContent = "No saved events yet.";
      eventList.append(empty);
    }
  }

  function setInputValue(element, value) {
    element.value = value === null || value === undefined ? "" : String(value);
  }

  function renderFields(event) {
    eventTitle.textContent = event.name;
    for (const element of fieldElements) setInputValue(element, event[element.dataset.field]);
  }

  function forecast(event) {
    const expectedOrders = Math.ceil(event.attendance * (event.captureRate / 100));
    const prepTarget = Math.ceil(expectedOrders * (1 + event.bufferRate / 100));
    const serviceMinutes = minutesBetween(event.openTime, event.closeTime);
    const serviceHours = Math.max(.25, serviceMinutes / 60);
    const hourlyDemand = expectedOrders / serviceHours;
    const ovenRate = event.batchSize * 60 / event.cycleMinutes;
    const ovenCycles = Math.max(0, Math.floor(serviceMinutes / event.cycleMinutes));
    const serviceCapacity = event.openingReady + (ovenCycles * event.batchSize);
    return { expectedOrders, prepTarget, serviceMinutes, serviceHours, hourlyDemand, ovenRate, serviceCapacity };
  }

  function metric(label, value, detail, alert = false) {
    const card = document.createElement("article");
    card.className = `metric${alert ? " is-alert" : ""}`;
    const small = document.createElement("small");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    small.textContent = label; strong.textContent = value; span.textContent = detail;
    card.append(small, strong, span); return card;
  }

  function renderForecast(event) {
    const data = forecast(event);
    const container = document.querySelector("[data-forecast-metrics]");
    const over = data.hourlyDemand > data.ovenRate;
    container.replaceChildren(
      metric("Expected orders", String(data.expectedOrders), `${event.attendance.toLocaleString()} people × ${event.captureRate}% capture`),
      metric("Prep target", String(data.prepTarget), `${event.bufferRate}% buffer included`),
      metric("Required pace", `${data.hourlyDemand.toFixed(1)}/hr`, `${(data.hourlyDemand / 4).toFixed(1)} sales every 15 minutes`, over),
      metric("Oven pace", `${data.ovenRate.toFixed(1)}/hr`, `${event.batchSize} every ${event.cycleMinutes} minutes`, over),
    );
  }

  function renderMenuMix(event) {
    const target = forecast(event).prepTarget;
    const container = document.querySelector("[data-menu-mix]");
    container.replaceChildren();
    for (const item of event.menu) {
      const row = document.createElement("div"); row.className = "mix-row";
      const name = document.createElement("strong"); name.textContent = item.name;
      const label = document.createElement("label"); label.textContent = "Sales mix %";
      const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = "100"; input.step = ".1"; input.value = item.mix;
      input.addEventListener("input", () => { item.mix = number(input.value); markDirty(); updateMixDisplay(event); });
      label.append(input);
      const count = document.createElement("div"); count.className = "mix-count"; count.textContent = String(Math.round(target * item.mix / 100));
      row.append(name, label, count); container.append(row);
    }
    const total = event.menu.reduce((sum, item) => sum + number(item.mix), 0);
    const totalElement = document.querySelector("[data-mix-total]");
    totalElement.textContent = `Mix total: ${total.toFixed(1)}%${Math.abs(total - 100) > .05 ? " — adjust to 100%" : " ✓"}`;
    totalElement.classList.toggle("is-error", Math.abs(total - 100) > .05);
  }

  function updateMixDisplay(event) {
    const target = forecast(event).prepTarget;
    document.querySelectorAll("[data-menu-mix] .mix-row").forEach((row, index) => {
      const count = row.querySelector(".mix-count");
      if (count && event.menu[index]) count.textContent = String(Math.round(target * event.menu[index].mix / 100));
    });
    const total = event.menu.reduce((sum, item) => sum + number(item.mix), 0);
    const totalElement = document.querySelector("[data-mix-total]");
    totalElement.textContent = `Mix total: ${total.toFixed(1)}%${Math.abs(total - 100) > .05 ? " — adjust to 100%" : " ✓"}`;
    totalElement.classList.toggle("is-error", Math.abs(total - 100) > .05);
  }

  function minutes(time) { const [hour, minute] = String(time || "00:00").split(":").map(Number); return hour * 60 + minute; }
  function minutesBetween(start, end) { let value = minutes(end) - minutes(start); if (value <= 0) value += 1440; return value; }
  function timeAt(base, offset) { let total = (minutes(base) + offset) % 1440; if (total < 0) total += 1440; const hour = Math.floor(total / 60); const minute = total % 60; return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(2020, 0, 1, hour, minute)); }

  function renderTimeline(event) {
    const list = document.querySelector("[data-timeline]");
    const readyBatches = Math.max(1, Math.ceil(event.openingReady / event.batchSize));
    const cookingBatches = Math.max(1, Math.ceil(event.openingCooking / event.batchSize));
    const firstServiceEndOffset = 5;
    const firstReadyEndOffset = firstServiceEndOffset - (cookingBatches * event.cycleMinutes);
    const firstReadyStartOffset = firstReadyEndOffset - ((readyBatches - 1) * event.cycleMinutes) - event.cycleMinutes;
    const steps = [
      [firstReadyStartOffset - 95, "Preheat & preflight", "Power, water, pans, thermometers, warmer and service-line check."],
      [firstReadyStartOffset - 90, "Reheat hot toppings", "Bring TCS toppings to 165°F for 15 seconds within 2 hours; move to 135°F+ hot holding."],
      [firstReadyStartOffset - 5, "Clear the combi", "Finish topping work and protect the oven for potatoes."],
    ];
    for (let index = 0; index < readyBatches; index += 1) {
      const startOffset = firstReadyStartOffset + index * event.cycleMinutes;
      steps.push([startOffset, `Load opening batch ${index + 1}`, `${event.batchSize} potatoes · unload about ${timeAt(event.openTime, startOffset + event.cycleMinutes)}; vent 5–10 minutes.`]);
    }
    steps.push([minutes(event.setupTime) - minutes(event.openTime), "Event setup", "Build the line, verify labels, FIFO order and packaging."], [firstServiceEndOffset - event.cycleMinutes, "Load first service batch", `${event.openingCooking} cooking at open; expected out about ${timeAt(event.openTime, firstServiceEndOffset)}.`], [-10, "Opening verification", "Confirm ready count, center temperatures, hot holds and role assignments."], [0, "Open for service", "Sell the oldest verified batch first. Begin 15-minute pace calls."]);
    steps.sort((a, b) => a[0] - b[0]);
    list.replaceChildren(...steps.map(([offset, title, detail]) => {
      const li = document.createElement("li"); const time = document.createElement("time"); const strong = document.createElement("strong"); const p = document.createElement("p");
      time.textContent = timeAt(event.openTime, offset); strong.textContent = title; p.textContent = detail; li.append(time, strong, p); return li;
    }));
  }

  function renderOpeningTargets(event) {
    const data = forecast(event); const target = document.querySelector("[data-opening-targets]"); target.replaceChildren(); const dl = document.createElement("dl");
    for (const [label, value] of [["Ready at open", event.openingReady], ["Cooking at open", event.openingCooking], ["Service capacity", data.serviceCapacity], ["Prep target", data.prepTarget]]) {
      const row = document.createElement("div"); const dt = document.createElement("dt"); const dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; row.append(dt, dd); dl.append(row);
    }
    const p = document.createElement("p"); p.textContent = data.prepTarget > data.serviceCapacity ? "Warning: forecast exceeds this single-oven service model. Increase opening inventory, extend production time, cap orders, or add capacity." : "Forecast fits the modeled production capacity. Keep 30–45 ready during service."; p.className = data.prepTarget > data.serviceCapacity ? "is-error" : "is-success"; target.append(dl, p);
  }

  function renderLiveSummary(event) {
    const data = forecast(event); const container = document.querySelector("[data-live-summary]"); const items = [["Event", event.name], ["Open", timeAt(event.openTime, 0)], ["Opening target", `${event.openingReady} ready + ${event.openingCooking} cooking`], ["Oven capacity", `${data.ovenRate.toFixed(1)} / hr`]];
    container.replaceChildren(...items.map(([label, value]) => { const box = document.createElement("div"); const small = document.createElement("small"); const strong = document.createElement("strong"); small.textContent = label; strong.textContent = value; box.append(small, strong); return box; }));
  }

  function renderReview(event) {
    const forecastOrders = forecast(event).expectedOrders;
    const actual = event.actualOrders;
    const capture = actual === null || !event.attendance ? null : actual / event.attendance * 100;
    const variance = actual === null ? null : actual - forecastOrders;
    const results = document.querySelector("[data-review-results]");
    const cards = [["Forecast variance", variance === null ? "—" : `${variance > 0 ? "+" : ""}${variance}`, variance === null ? "Enter actual orders" : `${forecastOrders} forecast vs ${actual} actual`], ["Actual capture", capture === null ? "—" : `${capture.toFixed(1)}%`, capture === null ? "Attendance and actual orders required" : `${event.attendance} attendance`], ["Waste rate", actual === null || event.actualWaste === null ? "—" : `${(event.actualWaste / Math.max(1, actual + event.actualWaste) * 100).toFixed(1)}%`, event.actualWaste === null ? "Enter waste / discard" : `${event.actualWaste} units recorded`]];
    results.replaceChildren(...cards.map(([label, value, detail]) => { const card = document.createElement("article"); card.className = "review-card"; const small = document.createElement("small"); const strong = document.createElement("strong"); const span = document.createElement("span"); small.textContent = label; strong.textContent = value; span.textContent = detail; card.append(small, strong, span); return card; }));
    const actualItems = document.querySelector("[data-actual-items]"); actualItems.replaceChildren();
    for (const item of event.menu) {
      const row = document.createElement("div"); row.className = "actual-row"; const name = document.createElement("strong"); name.textContent = item.name;
      for (const [labelText, key] of [["Sold", "actualSold"], ["Leftover", "leftover"]]) { const label = document.createElement("label"); label.textContent = labelText; const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.placeholder = "—"; setInputValue(input, item[key]); input.addEventListener("input", () => { item[key] = optionalNumber(input.value); markDirty(); }); label.append(input); row.append(name.parentNode ? document.createTextNode("") : name, label); }
      actualItems.append(row);
    }
  }

  function renderCalculated() {
    const event = activeEvent(); if (!event) return;
    eventTitle.textContent = event.name || "Untitled event";
    renderForecast(event); renderMenuMix(event); renderTimeline(event); renderOpeningTargets(event); renderLiveSummary(event); renderReview(event); renderEventList();
  }

  function selectEvent(id) {
    activeId = id; const event = activeEvent(); if (!event) return;
    renderFields(event); renderCalculated(); loadLogs();
  }

  fieldElements.forEach((element) => {
    element.addEventListener("input", () => {
      const event = activeEvent(); if (!event) return;
      const key = element.dataset.field;
      if (["attendance", "captureRate", "bufferRate", "crewCount", "batchSize", "cycleMinutes", "openingReady", "openingCooking"].includes(key)) event[key] = number(element.value);
      else if (["actualOrders", "actualWaste", "peakFifteen"].includes(key)) event[key] = optionalNumber(element.value);
      else event[key] = element.value;
      markDirty(); renderCalculated();
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach((candidate) => candidate.setAttribute("aria-selected", String(candidate === button)));
    document.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.dataset.panel !== button.dataset.tab; });
  }));

  async function requestTemplate(kind) {
    const { response, result } = await api("/api/event-planner/manage", { method: "POST", body: JSON.stringify({ action: "template", template: kind }) });
    if (!response.ok) throw new Error(result.message || "Could not create template.");
    const event = result.event; event.id = `${event.id}-${Date.now().toString(36)}`; planner.events.unshift(event); activeId = event.id; renderEventList(); renderFields(event); renderCalculated(); loadLogs(); markDirty();
  }

  document.querySelector("[data-new-event]")?.addEventListener("click", () => requestTemplate("blank").catch((error) => message(saveState, error.message, "error")));
  document.querySelector("[data-template-2590]")?.addEventListener("click", () => requestTemplate("2590").catch((error) => message(saveState, error.message, "error")));
  document.querySelector("[data-duplicate]")?.addEventListener("click", () => {
    const source = activeEvent(); if (!source) return; const clone = structuredClone(source); clone.id = `event-${Date.now().toString(36)}`; clone.name = `${source.name} copy`; clone.actualOrders = null; clone.actualWaste = null; clone.peakFifteen = null; clone.reviewNotes = ""; clone.paceLog = []; clone.productionLog = []; clone.tempLog = []; clone.menu.forEach((item) => { item.actualSold = null; item.leftover = null; }); planner.events.unshift(clone); activeId = clone.id; renderFields(clone); renderCalculated(); loadLogs(); markDirty();
  });
  document.querySelector("[data-delete]")?.addEventListener("click", () => {
    const event = activeEvent(); if (!event || !window.confirm(`Delete “${event.name}”?`)) return; planner.events = planner.events.filter((candidate) => candidate.id !== event.id); activeId = planner.events[0]?.id || null; renderEventList(); if (activeEvent()) { renderFields(activeEvent()); renderCalculated(); loadLogs(); } markDirty();
  });

  saveButton?.addEventListener("click", async () => {
    if (!planner || !dirty) return; busy(saveButton, true, "Saving…");
    try {
      const { response, result } = await api("/api/event-planner/manage", { method: "POST", body: JSON.stringify({ action: "save", expectedRevision: planner.revision, planner }) });
      if (response.status === 401) return showLogin("Your session expired. Sign in again.", "error");
      if (!response.ok) throw new Error(result.message || "Could not save the planner.");
      planner = result.planner; setClean("Saved. Your event plan is available on every device."); renderEventList();
    } catch (error) { message(saveState, error.message || "Could not save.", "error"); }
    finally { busy(saveButton, false, "Saving…"); saveButton.disabled = !dirty; }
  });

  document.querySelector("[data-print]")?.addEventListener("click", () => window.print());
  document.querySelector("[data-logout]")?.addEventListener("click", async () => { if (dirty && !window.confirm("Sign out and discard unsaved changes?")) return; await api("/api/event-planner/manage", { method: "POST", body: JSON.stringify({ action: "logout" }) }); showLogin("Signed out.", "success"); });

  function showLogin(text = "", type = "") { loginPanel.hidden = false; app.hidden = true; message(loginMessage, text, type); }
  function showApp() { loginPanel.hidden = true; app.hidden = false; }

  async function loadPlanner() {
    try {
      const { response, result } = await api("/api/event-planner/manage");
      if (response.status === 401) return showLogin();
      if (!response.ok) return showLogin(result.message || "Planner unavailable.", "error");
      planner = result.planner; showApp();
      if (!planner.events.length) { await requestTemplate("2590"); message(saveState, "Starter plan loaded. Save it when ready.", "error"); }
      else { activeId = planner.events[0].id; renderEventList(); renderFields(activeEvent()); renderCalculated(); loadLogs(); setClean(); }
    } catch { showLogin("Could not connect to the planner.", "error"); }
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = loginForm.querySelector("button"); const password = new FormData(loginForm).get("password"); busy(button, true, "Signing in…"); message(loginMessage);
    try { const { response, result } = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); if (!response.ok) throw new Error(result.message || "Sign-in failed."); loginForm.reset(); await loadPlanner(); }
    catch (error) { message(loginMessage, error.message || "Could not sign in.", "error"); }
    finally { busy(button, false, "Signing in…"); }
  });

  function readLogs() { const event = activeEvent(); return { pace: event?.paceLog || [], production: event?.productionLog || [], temp: event?.tempLog || [] }; }
  function saveLogs() { const event = activeEvent(); if (!event) return; event.paceLog = rowsFrom("[data-pace-log]"); event.productionLog = rowsFrom("[data-production-log]"); event.tempLog = rowsFrom("[data-temp-log]"); markDirty(); }
  function rowsFrom(selector) { return [...document.querySelector(selector).querySelectorAll("tr")].map((row) => [...row.querySelectorAll("input")].map((input) => input.value)); }

  function addLogRow(type, values = []) {
    const map = { pace: ["time", "number", "number", "number", "time"], production: ["text", "time", "time", "text", "text"], temp: ["time", "text", "text", "text", "text"] };
    const body = document.querySelector(`[data-${type === "pace" ? "pace" : type === "production" ? "production" : "temp"}-log]`); const row = document.createElement("tr");
    map[type].forEach((inputType, index) => { const cell = document.createElement("td"); const input = document.createElement("input"); input.type = inputType; if (inputType === "number") input.min = "0"; input.value = values[index] || ""; input.addEventListener("input", () => { if (type === "pace") updatePaceRow(row); saveLogs(); }); cell.append(input); row.append(cell); });
    if (type === "pace") { const paceCell = document.createElement("td"); paceCell.dataset.paceResult = ""; row.append(paceCell); }
    const deleteCell = document.createElement("td"); const remove = document.createElement("button"); remove.type = "button"; remove.className = "row-delete"; remove.textContent = "×"; remove.addEventListener("click", () => { row.remove(); saveLogs(); }); deleteCell.append(remove); row.append(deleteCell); body.append(row); if (type === "pace") updatePaceRow(row);
  }

  function updatePaceRow(row) { const sold = number(row.querySelectorAll("input")[1]?.value); const result = row.querySelector("[data-pace-result]"); const level = sold >= 9 ? "red" : sold >= 7 ? "yellow" : "green"; const action = level === "red" ? "Quote waits · bake nonstop" : level === "yellow" ? "Bake nonstop" : "Hold 20–45 ready"; result.replaceChildren(); const badge = document.createElement("span"); badge.className = `pace-badge ${level}`; badge.textContent = `${level} · ${action}`; result.append(badge); }
  function loadLogs() { const logs = readLogs(); for (const [type, selector] of [["pace", "[data-pace-log]"], ["production", "[data-production-log]"], ["temp", "[data-temp-log]"]]) { document.querySelector(selector).replaceChildren(); const rows = Array.isArray(logs[type]) && logs[type].length ? logs[type] : [[]]; rows.forEach((values) => addLogRow(type, values)); } }
  document.querySelector("[data-add-pace]")?.addEventListener("click", () => addLogRow("pace")); document.querySelector("[data-add-production]")?.addEventListener("click", () => addLogRow("production")); document.querySelector("[data-add-temp]")?.addEventListener("click", () => addLogRow("temp"));

  window.addEventListener("beforeunload", (event) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; });
  void loadPlanner();
})();
