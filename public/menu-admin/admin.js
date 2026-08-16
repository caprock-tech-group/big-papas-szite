(() => {
  "use strict";

  const loginPanel = document.querySelector("[data-login-panel]");
  const loginForm = document.querySelector("[data-login-form]");
  const loginMessage = document.querySelector("[data-login-message]");
  const dashboard = document.querySelector("[data-dashboard]");
  const productEditors = document.querySelector("[data-product-editors]");
  const previewFrame = document.querySelector("[data-preview-frame]");
  const previewShell = document.querySelector("[data-preview-shell]");
  const saveButton = document.querySelector("[data-save-button]");
  const saveMessage = document.querySelector("[data-save-message]");
  const dirtyLabel = document.querySelector("[data-dirty-label]");
  const syncStatus = document.querySelector("[data-sync-status]");
  const syncTitle = document.querySelector("[data-sync-title]");
  const syncDetail = document.querySelector("[data-sync-detail]");
  if (!loginPanel || !dashboard || !productEditors) return;

  let currentMenu = null;
  let dirty = false;
  let previewQueued = false;

  function setMessage(element, message = "", type = "") {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }
    return { response, result };
  }

  function showLogin(message = "", type = "") {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    setMessage(loginMessage, message, type);
  }

  function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
  }

  function formatDate(value) {
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

  function announcementSpeedLabel(value) {
    const speed = Number(value);
    if (speed <= 25) return "Slow";
    if (speed <= 45) return "Normal";
    if (speed <= 65) return "Fast";
    return "Very fast";
  }

  function updateAnnouncementSpeedLabel() {
    const input = document.querySelector("[data-announcement-speed]");
    const output = document.querySelector("[data-announcement-speed-label]");
    if (input && output) output.value = announcementSpeedLabel(input.value);
  }

  function setCleanState(menu) {
    dirty = false;
    if (saveButton) saveButton.disabled = true;
    if (dirtyLabel) dirtyLabel.textContent = "Everything is saved";
    setMessage(saveMessage, "Menu changes update every board and the public website within seconds.");
    syncStatus?.classList.remove("is-dirty");
    if (syncTitle) syncTitle.textContent = "Published and ready";
    if (syncDetail) syncDetail.textContent = `Last updated ${formatDate(menu.updatedAt)}`;
  }

  function queuePreview() {
    if (previewQueued) return;
    previewQueued = true;
    window.requestAnimationFrame(() => {
      previewQueued = false;
      sendPreview();
    });
  }

  function markDirty() {
    if (!currentMenu) return;
    dirty = true;
    if (saveButton) saveButton.disabled = false;
    if (dirtyLabel) dirtyLabel.textContent = "Unpublished menu changes";
    setMessage(saveMessage, "Review the preview, then publish when you're ready.");
    syncStatus?.classList.add("is-dirty");
    if (syncTitle) syncTitle.textContent = "Changes waiting to publish";
    if (syncDetail) syncDetail.textContent = "The live board and public website are still showing the last saved version.";
    queuePreview();
  }

  function field(label, selector, value, attributes = "") {
    return `<label class="field"><span>${label}</span><input ${selector} ${attributes}></label>`;
  }

  function createProductEditor(item, index, total) {
    const article = document.createElement("article");
    article.className = `product-editor${item.visible === false ? " is-hidden" : ""}`;
    article.dataset.productId = item.id;
    article.innerHTML = `
      <div class="reorder-controls">
        <button type="button" data-move="up" aria-label="Move product up" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-move="down" aria-label="Move product down" ${index === total - 1 ? "disabled" : ""}>↓</button>
      </div>
      <div class="product-editor-body">
        <div class="product-editor-top">
          ${field("Product name", "data-product-name", "", "maxlength=\"70\"")}
          ${field("Price", "data-product-price", "", "inputmode=\"decimal\" maxlength=\"16\"")}
          <label class="field"><span>Accent</span><select data-product-accent><option value="red">Red</option><option value="blue">Blue</option><option value="gold">Gold</option></select></label>
          <button class="delete-button" type="button" data-delete-product>Remove</button>
        </div>
        <div class="product-editor-bottom">
          <div>
            ${field("Small heading", "data-product-eyebrow", "", "maxlength=\"48\"")}
            <label class="field"><span>Description</span><textarea data-product-description maxlength="220" rows="2"></textarea></label>
          </div>
          <div class="editor-toggles">
            <label class="editor-toggle"><input data-product-visible type="checkbox"> Show</label>
            <label class="editor-toggle"><input data-product-available type="checkbox"> In stock</label>
            <label class="editor-toggle"><input data-product-new type="checkbox"> New badge</label>
          </div>
        </div>
      </div>`;

    article.querySelector("[data-product-name]").value = item.name || "";
    article.querySelector("[data-product-price]").value = item.price || "";
    article.querySelector("[data-product-accent]").value = item.accent || "red";
    article.querySelector("[data-product-eyebrow]").value = item.eyebrow || "";
    article.querySelector("[data-product-description]").value = item.description || "";
    article.querySelector("[data-product-visible]").checked = item.visible !== false;
    article.querySelector("[data-product-available]").checked = item.available !== false;
    article.querySelector("[data-product-new]").checked = item.isNew === true;
    return article;
  }

  function createSmallEditor(item, category, index, total) {
    const row = document.createElement("article");
    row.className = `small-item-editor${item.visible === false ? " is-hidden" : ""}`;
    row.dataset.smallId = item.id;
    row.dataset.category = category;
    row.innerHTML = `
      <input type="text" data-small-name maxlength="60" aria-label="Item name">
      <input type="text" data-small-price inputmode="decimal" maxlength="16" aria-label="Price">
      <label><input type="checkbox" data-small-visible>Show</label>
      <label><input type="checkbox" data-small-available>Stock</label>
      <button type="button" data-move="up" aria-label="Move item up" ${index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-move="down" aria-label="Move item down" ${index === total - 1 ? "disabled" : ""}>↓</button>
      <button class="delete-small" type="button" data-delete-small aria-label="Remove item">×</button>`;
    row.querySelector("[data-small-name]").value = item.name || "";
    row.querySelector("[data-small-price]").value = item.price || "";
    row.querySelector("[data-small-visible]").checked = item.visible !== false;
    row.querySelector("[data-small-available]").checked = item.available !== false;
    return row;
  }

  function renderProducts(items) {
    productEditors.replaceChildren(...items.map((item, index) => createProductEditor(item, index, items.length)));
  }

  function renderSmallItems(category, items) {
    const container = document.querySelector(`[data-small-editors="${category}"]`);
    if (!container) return;
    container.replaceChildren(...items.map((item, index) => createSmallEditor(item, category, index, items.length)));
  }

  function renderMenu(menu) {
    currentMenu = menu;
    document.querySelector("[data-orientation]").value = menu.board?.orientation || "auto";
    document.querySelector("[data-headline]").value = menu.board?.headline || "";
    document.querySelector("[data-subheadline]").value = menu.board?.subheadline || "";
    document.querySelector("[data-announcement]").value = menu.board?.announcement || "";
    document.querySelector("[data-announcement-speed]").value = String(menu.board?.announcementSpeed || 40);
    updateAnnouncementSpeedLabel();
    document.querySelector("[data-show-descriptions]").checked = menu.board?.showDescriptions !== false;
    document.querySelector("[data-combo-enabled]").checked = menu.combo?.enabled !== false;
    document.querySelector("[data-combo-label]").value = menu.combo?.label || "";
    document.querySelector("[data-combo-description]").value = menu.combo?.description || "";
    document.querySelector("[data-combo-price]").value = menu.combo?.price || "";
    renderProducts(Array.isArray(menu.products) ? menu.products : []);
    renderSmallItems("addOns", Array.isArray(menu.addOns) ? menu.addOns : []);
    renderSmallItems("drinks", Array.isArray(menu.drinks) ? menu.drinks : []);
    setCleanState(menu);
    queuePreview();
  }

  function collectProducts() {
    return [...productEditors.querySelectorAll("[data-product-id]")].map((article) => ({
      id: article.dataset.productId,
      name: article.querySelector("[data-product-name]").value,
      price: article.querySelector("[data-product-price]").value,
      accent: article.querySelector("[data-product-accent]").value,
      eyebrow: article.querySelector("[data-product-eyebrow]").value,
      description: article.querySelector("[data-product-description]").value,
      visible: article.querySelector("[data-product-visible]").checked,
      available: article.querySelector("[data-product-available]").checked,
      isNew: article.querySelector("[data-product-new]").checked,
    }));
  }

  function collectSmallItems(category) {
    const container = document.querySelector(`[data-small-editors="${category}"]`);
    if (!container) return [];
    return [...container.querySelectorAll("[data-small-id]")].map((row) => ({
      id: row.dataset.smallId,
      name: row.querySelector("[data-small-name]").value,
      price: row.querySelector("[data-small-price]").value,
      visible: row.querySelector("[data-small-visible]").checked,
      available: row.querySelector("[data-small-available]").checked,
    }));
  }

  function collectMenu() {
    return {
      version: 3,
      revision: currentMenu?.revision || 1,
      updatedAt: currentMenu?.updatedAt || new Date().toISOString(),
      board: {
        orientation: document.querySelector("[data-orientation]").value,
        headline: document.querySelector("[data-headline]").value,
        subheadline: document.querySelector("[data-subheadline]").value,
        announcement: document.querySelector("[data-announcement]").value,
        announcementSpeed: Number(document.querySelector("[data-announcement-speed]").value),
        showDescriptions: document.querySelector("[data-show-descriptions]").checked,
      },
      products: collectProducts(),
      addOns: collectSmallItems("addOns"),
      drinks: collectSmallItems("drinks"),
      combo: {
        enabled: document.querySelector("[data-combo-enabled]").checked,
        label: document.querySelector("[data-combo-label]").value,
        description: document.querySelector("[data-combo-description]").value,
        price: document.querySelector("[data-combo-price]").value,
      },
    };
  }

  function sendPreview() {
    if (!previewFrame?.contentWindow || !currentMenu) return;
    previewFrame.contentWindow.postMessage(
      { type: "bigpapas-menu-preview", menu: collectMenu() },
      window.location.origin,
    );
  }

  function newId(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
    return `${prefix}-${Date.now().toString(36)}`;
  }

  function rerenderFromDom() {
    const draft = collectMenu();
    renderProducts(draft.products);
    renderSmallItems("addOns", draft.addOns);
    renderSmallItems("drinks", draft.drinks);
    markDirty();
  }

  function moveElement(element, direction) {
    const sibling = direction === "up" ? element.previousElementSibling : element.nextElementSibling;
    if (!sibling) return;
    if (direction === "up") element.parentElement.insertBefore(element, sibling);
    else element.parentElement.insertBefore(sibling, element);
    rerenderFromDom();
  }

  dashboard.addEventListener("input", (event) => {
    if (event.target.matches("[data-announcement-speed]")) updateAnnouncementSpeedLabel();
    const editor = event.target.closest(".product-editor, .small-item-editor");
    if (editor) {
      const visible = editor.querySelector("[data-product-visible], [data-small-visible]");
      editor.classList.toggle("is-hidden", visible && !visible.checked);
    }
    markDirty();
  });

  dashboard.addEventListener("change", (event) => {
    const editor = event.target.closest(".product-editor, .small-item-editor");
    if (editor) {
      const visible = editor.querySelector("[data-product-visible], [data-small-visible]");
      editor.classList.toggle("is-hidden", visible && !visible.checked);
    }
    markDirty();
  });

  dashboard.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.matches("[data-move]")) {
      const editor = button.closest(".product-editor, .small-item-editor");
      if (editor) moveElement(editor, button.dataset.move);
      return;
    }

    if (button.matches("[data-delete-product]")) {
      const editor = button.closest(".product-editor");
      if (editor && window.confirm("Remove this product from the menu editor?")) {
        editor.remove();
        rerenderFromDom();
      }
      return;
    }

    if (button.matches("[data-delete-small]")) {
      const editor = button.closest(".small-item-editor");
      if (editor && window.confirm("Remove this item?")) {
        editor.remove();
        rerenderFromDom();
      }
    }
  });

  document.querySelector("[data-add-product]")?.addEventListener("click", () => {
    const draft = collectMenu();
    draft.products.push({
      id: newId("product"),
      name: "New loaded potato",
      eyebrow: "Loaded favorite",
      price: "$0.00",
      description: "Add a short ingredient description.",
      accent: "red",
      isNew: true,
      available: true,
      visible: true,
    });
    renderProducts(draft.products);
    markDirty();
    productEditors.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.querySelectorAll("[data-add-small]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.addSmall;
      const draft = collectMenu();
      draft[category].push({
        id: newId(category === "drinks" ? "drink" : "add-on"),
        name: category === "drinks" ? "New drink" : "New add-on",
        price: "$0.00",
        available: true,
        visible: true,
      });
      renderSmallItems(category, draft[category]);
      markDirty();
    });
  });

  document.querySelectorAll("[data-preview-orientation]").forEach((button) => {
    button.addEventListener("click", () => {
      const orientation = button.dataset.previewOrientation;
      document.querySelectorAll("[data-preview-orientation]").forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(candidate === button));
      });
      previewShell.classList.toggle("preview-frame--portrait", orientation === "portrait");
      previewShell.classList.toggle("preview-frame--landscape", orientation !== "portrait");
      previewFrame.src = `/menu-board/?preview=1&orientation=${orientation}`;
    });
  });

  previewFrame?.addEventListener("load", () => window.setTimeout(sendPreview, 80));

  document.querySelectorAll("[data-copy-board-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      const orientation = button.dataset.copyBoardLink;
      const url = `${window.location.origin}/menu-board/?orientation=${orientation}`;
      try {
        await navigator.clipboard.writeText(url);
        const original = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => { button.textContent = original; }, 1600);
      } catch {
        window.prompt("Copy this menu board link:", url);
      }
    });
  });

  async function loadDashboard() {
    try {
      const { response, result } = await request("/api/menu/manage");
      if (response.ok) {
        showDashboard();
        renderMenu(result.menu);
        return;
      }
      if (response.status === 401) {
        showLogin();
        return;
      }
      showLogin(result.message || "Menu manager unavailable.", "error");
    } catch {
      showLogin("Could not connect to the menu manager. Try again.", "error");
    }
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = loginForm.querySelector("button[type=submit]");
    const password = new FormData(loginForm).get("password");
    setBusy(submit, true, "Signing in…");
    setMessage(loginMessage);
    try {
      const { response, result } = await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setMessage(loginMessage, result.message || "Sign-in failed.", "error");
        return;
      }
      loginForm.reset();
      await loadDashboard();
    } catch {
      setMessage(loginMessage, "Could not sign in. Check your connection.", "error");
    } finally {
      setBusy(submit, false, "Signing in…");
    }
  });

  saveButton?.addEventListener("click", async () => {
    if (!currentMenu || !dirty) return;
    setBusy(saveButton, true, "Publishing…");
    setMessage(saveMessage, "Publishing the new menu to every display…");
    try {
      const { response, result } = await request("/api/menu/manage", {
        method: "POST",
        body: JSON.stringify({
          action: "save",
          expectedRevision: currentMenu.revision,
          menu: collectMenu(),
        }),
      });
      if (response.status === 401) {
        showLogin("Your session expired. Sign in again.", "error");
        return;
      }
      if (!response.ok) {
        setMessage(saveMessage, result.message || "Could not publish the menu.", "error");
        return;
      }
      renderMenu(result.menu);
      setMessage(saveMessage, "Published. Every connected board will update within seconds.", "success");
    } catch {
      setMessage(saveMessage, "Could not publish. Check your connection and try again.", "error");
    } finally {
      setBusy(saveButton, false, "Publishing…");
      saveButton.disabled = !dirty;
    }
  });

  document.querySelector("[data-logout-button]")?.addEventListener("click", async () => {
    if (dirty && !window.confirm("Sign out and discard your unpublished changes?")) return;
    try {
      await request("/api/menu/manage", { method: "POST", body: JSON.stringify({ action: "logout" }) });
    } finally {
      currentMenu = null;
      dirty = false;
      showLogin("Signed out.", "success");
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  void loadDashboard();
})();
