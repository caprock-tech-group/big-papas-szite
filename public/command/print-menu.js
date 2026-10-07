import { printableMenu } from "/command/print-menu-model.js?v=1";

const qs = (selector) => document.querySelector(selector);
const sheet = qs("[data-sheet]");
const printButton = qs("[data-print]");
const reloadButton = qs("[data-reload]");
const status = qs("[data-status]");
const printHelp = qs("[data-print-help]");
const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
let ready = false;
let loading = false;

function node(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function text(selector, value) { qs(selector).textContent = value || ""; }

function renderSmallItems(selector, sectionSelector, items) {
  const target = qs(selector);
  target.replaceChildren(...items.map((item) => {
    const row = node("li");
    row.append(node("span", item.name), node("strong", item.available === false ? "Sold out" : item.price));
    return row;
  }));
  qs(sectionSelector).hidden = items.length === 0;
}

function render(menu) {
  const model = printableMenu(menu);
  text("[data-headline]", model.board.headline || "Texas Loaded Potatoes");
  text("[data-subheadline]", model.board.subheadline);
  text("[data-announcement]", model.board.announcement);
  qs("[data-announcement]").hidden = !model.board.announcement;
  qs("[data-cooking]").hidden = !model.cooking;
  text("[data-cooking-message]", model.board.cookingMessage);
  text("[data-potatoes-title]", model.lunch ? "Lunch potatoes" : "Loaded potatoes");
  text("[data-pricing-note]", model.lunch ? "Smaller taters & portions · Lunch prices" : "Big Papa’s favorites");
  qs("[data-products]").replaceChildren(...model.products.map((item) => {
    const article = node("article", "", "potato");
    const title = node("div", "", "potato-title");
    title.append(node("h4", item.name), node("strong", item.printPrice));
    article.append(title);
    if (item.description) article.append(node("p", item.description));
    if (item.status) article.append(node("span", item.status, "availability"));
    return article;
  }));
  renderSmallItems("[data-add-ons]", "[data-add-ons-section]", model.addOns);
  renderSmallItems("[data-drinks]", "[data-drinks-section]", model.drinks);
  qs("[data-combo]").hidden = !model.combo;
  if (model.combo) {
    text("[data-combo-label]", model.combo.label);
    text("[data-combo-description]", model.combo.description);
    text("[data-combo-price]", model.combo.price);
  }
  qs("[data-extras]").hidden = !model.addOns.length && !model.drinks.length && !model.combo;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  text("[data-printed-at]", `Printed ${formatter.format(new Date())} CT`);
  sheet.hidden = false;
}

function sizePreview() {
  // Keep the paper's actual layout dimensions even on a narrow phone screen.
  document.documentElement.style.setProperty("--preview-scale", String(Math.min(1, Math.max(.1, (document.documentElement.clientWidth - 24) / (7.8 * 96)))));
}

function fitSheet() {
  sheet.classList.remove("is-long");
  let fits = false;
  for (const density of ["normal", "compact", "dense"]) {
    sheet.dataset.density = density;
    fits = sheet.scrollHeight <= sheet.clientHeight + 1;
    if (fits) break;
  }
  // Never clip or silently drop items if a future menu grows beyond one page.
  sheet.classList.toggle("is-long", !fits);
  qs("[data-fit-warning]").hidden = fits;
  return fits;
}

function printMenu() {
  if (!ready) return;
  // Keep this synchronous: Safari must receive the request directly from the tap.
  // window.print() can also silently do nothing in an in-app/Home Screen browser.
  printHelp.open = true;
  status.textContent = "If no print dialog appears, follow the iPhone steps below. Nothing prints until you confirm with your printer.";
  try { window.print(); }
  catch { status.textContent = "This browser could not open printing. Use Safari’s Share → Print, or your browser’s print menu."; }
}

async function loadMenu(autoprint = false) {
  if (loading) return;
  loading = true;
  ready = false;
  document.body.classList.remove("is-ready");
  printButton.disabled = true;
  reloadButton.disabled = true;
  sheet.hidden = true;
  qs("[data-fit-warning]").hidden = true;
  status.textContent = "Loading the published menu…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/menu?print=${Date.now()}`, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Menu unavailable");
    render(await response.json());
    await Promise.all([document.fonts?.ready, ...[...sheet.querySelectorAll("img")].map((image) => image.decode().catch(() => {}))]);
    sizePreview();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fits = fitSheet();
    ready = true;
    document.body.classList.add("is-ready");
    printButton.disabled = false;
    status.textContent = fits ? "Current published menu · Fits one Letter page. Tap Print menu above to choose your printer." : "Current published menu · See the page-length note below, then tap Print menu.";
    // A tap on the previous page is no longer a user gesture after fetching the
    // menu, decoding images and waiting for layout. Do not auto-print on iOS.
    if (autoprint && fits && !isAppleMobile && !isStandalone) printMenu();
  } catch {
    sheet.hidden = true;
    status.textContent = "Could not load the current menu. Check your connection, then tap Reload latest menu. Nothing has been sent to a printer.";
  } finally {
    clearTimeout(timeout);
    reloadButton.disabled = false;
    loading = false;
  }
}

printButton.addEventListener("click", printMenu);
reloadButton.addEventListener("click", () => loadMenu());
window.addEventListener("resize", sizePreview);
window.addEventListener("beforeprint", () => { if (ready) fitSheet(); });
printHelp.open = isAppleMobile || isStandalone;
sizePreview();
void loadMenu(new URLSearchParams(location.search).get("autoprint") === "1");
