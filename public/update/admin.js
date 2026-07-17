(() => {
  "use strict";

  const selectors = {
    loginPanel: "[data-login-panel]",
    loginForm: "[data-login-form]",
    loginMessage: "[data-login-message]",
    dashboard: "[data-dashboard]",
    currentStatus: "[data-current-status]",
    currentStatusTitle: "[data-current-status-title]",
    currentStatusDetail: "[data-current-status-detail]",
    locateButton: "[data-locate-button]",
    coordinatePreview: "[data-coordinate-preview]",
    coordinateDetail: "[data-coordinate-detail]",
    previewMap: "[data-preview-map]",
    locationMessage: "[data-location-message]",
    locationName: "[data-location-name]",
    hours: "[data-hours]",
    expiration: "[data-expiration]",
    note: "[data-note]",
    publishButton: "[data-publish-button]",
    publishMessage: "[data-publish-message]",
    clearButton: "[data-clear-button]",
    logoutButton: "[data-logout-button]",
  };

  const elements = Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [key, document.querySelector(selector)]),
  );

  const state = {
    coordinates: null,
  };

  function setMessage(element, message = "", type = "") {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (!button.dataset.defaultMarkup) button.dataset.defaultMarkup = button.innerHTML;
    button.disabled = busy;
    if (busy) {
      button.textContent = busyLabel;
    } else {
      button.innerHTML = button.dataset.defaultMarkup;
    }
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
    if (elements.loginPanel) elements.loginPanel.hidden = false;
    if (elements.dashboard) elements.dashboard.hidden = true;
    setMessage(elements.loginMessage, message, type);
  }

  function showDashboard() {
    if (elements.loginPanel) elements.loginPanel.hidden = true;
    if (elements.dashboard) elements.dashboard.hidden = false;
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

  function renderCurrent(location, expired = false) {
    const isLive = Boolean(location && location.live && !expired);
    elements.currentStatus?.classList.toggle("is-live", isLive);

    if (isLive) {
      const place = location.locationName?.trim() || "Live pin published";
      elements.currentStatusTitle.textContent = place;
      elements.currentStatusDetail.textContent = `Visible until ${formatDate(location.expiresAt)}`;
      elements.locationName.value = location.locationName || "";
      elements.hours.value = location.hours || "";
      elements.note.value = location.note || "";
      return;
    }

    elements.currentStatusTitle.textContent = expired ? "Previous pin expired" : "No live location";
    elements.currentStatusDetail.textContent = expired
      ? "Customers now see the standard service-area message."
      : "The website is showing the standard service-area message.";
  }

  async function loadDashboard() {
    try {
      const { response, result } = await request("/api/location/manage");
      if (response.ok) {
        showDashboard();
        renderCurrent(result.location, result.expired);
        return;
      }
      if (response.status === 401) {
        showLogin();
        return;
      }
      if (response.status === 503) {
        showLogin(
          "Setup needed: add LOCATION_ADMIN_PASSWORD in Netlify before signing in.",
          "error",
        );
        return;
      }
      showLogin("The location service is temporarily unavailable. Please try again.", "error");
    } catch {
      showLogin("The location service is temporarily unavailable. Please try again.", "error");
    }
  }

  elements.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = elements.loginForm.querySelector("button[type='submit']");
    const passwordInput = elements.loginForm.querySelector("input[name='password']");
    const password = passwordInput?.value || "";
    setMessage(elements.loginMessage);
    setBusy(submitButton, true, "Signing in…");

    try {
      const { response, result } = await request("/api/location/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const message = response.status === 503
          ? "Setup needed: add LOCATION_ADMIN_PASSWORD in Netlify first."
          : result.message || "That password didn't work.";
        setMessage(elements.loginMessage, message, "error");
        return;
      }
      if (passwordInput) passwordInput.value = "";
      await loadDashboard();
    } catch {
      setMessage(elements.loginMessage, "Could not sign in. Check your connection and try again.", "error");
    } finally {
      setBusy(submitButton, false, "Signing in…");
    }
  });

  elements.locateButton?.addEventListener("click", () => {
    setMessage(elements.locationMessage);
    if (!window.isSecureContext) {
      setMessage(elements.locationMessage, "Location access requires the secure HTTPS address.", "error");
      return;
    }
    if (!navigator.geolocation) {
      setMessage(elements.locationMessage, "This browser doesn't support location access.", "error");
      return;
    }

    setBusy(elements.locateButton, true, "Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        state.coordinates = { latitude, longitude, accuracy };
        const roundedAccuracy = Math.max(1, Math.round(accuracy));
        elements.coordinateDetail.textContent = `Accurate to about ${roundedAccuracy} meters`;
        elements.previewMap.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
        elements.coordinatePreview.hidden = false;
        elements.publishButton.disabled = false;
        setMessage(
          elements.locationMessage,
          roundedAccuracy <= 100
            ? "Location captured. Preview the pin, then publish when ready."
            : "Location captured, but accuracy is limited. Move into an open area and try again if the preview looks wrong.",
          roundedAccuracy <= 100 ? "success" : "",
        );
        setBusy(elements.locateButton, false, "Finding your location…");
      },
      (error) => {
        const messages = {
          1: "Location permission was denied. Allow location access in your browser settings and try again.",
          2: "Your phone couldn't determine its location. Move into an open area and try again.",
          3: "Location lookup timed out. Please try again.",
        };
        setMessage(elements.locationMessage, messages[error.code] || "Could not get your location.", "error");
        setBusy(elements.locateButton, false, "Finding your location…");
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    );
  });

  elements.publishButton?.addEventListener("click", async () => {
    if (!state.coordinates) {
      setMessage(elements.publishMessage, "Capture your current location first.", "error");
      return;
    }

    setMessage(elements.publishMessage);
    setBusy(elements.publishButton, true, "Publishing…");
    try {
      const { response, result } = await request("/api/location/manage", {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          ...state.coordinates,
          locationName: elements.locationName.value,
          hours: elements.hours.value,
          note: elements.note.value,
          expiresHours: Number(elements.expiration.value),
        }),
      });
      if (response.status === 401) {
        showLogin("Your session expired. Sign in and try again.", "error");
        return;
      }
      if (!response.ok) throw new Error(result.message || "Could not publish the location.");
      renderCurrent(result.location, false);
      setMessage(elements.publishMessage, "Live location published. The public website has been updated.", "success");
    } catch (error) {
      setMessage(elements.publishMessage, error.message || "Could not publish the location.", "error");
    } finally {
      setBusy(elements.publishButton, false, "Publishing…");
      elements.publishButton.disabled = !state.coordinates;
    }
  });

  elements.clearButton?.addEventListener("click", async () => {
    const confirmed = window.confirm("Remove the live pin from the public website now?");
    if (!confirmed) return;
    setBusy(elements.clearButton, true, "Removing…");
    setMessage(elements.publishMessage);
    try {
      const { response, result } = await request("/api/location/manage", {
        method: "POST",
        body: JSON.stringify({ action: "clear" }),
      });
      if (response.status === 401) {
        showLogin("Your session expired. Sign in and try again.", "error");
        return;
      }
      if (!response.ok) throw new Error(result.message || "Could not remove the location.");
      renderCurrent(null, false);
      state.coordinates = null;
      elements.coordinatePreview.hidden = true;
      elements.publishButton.disabled = true;
      setMessage(elements.publishMessage, "Live pin removed. Customers now see the standard message.", "success");
    } catch (error) {
      setMessage(elements.publishMessage, error.message || "Could not remove the location.", "error");
    } finally {
      setBusy(elements.clearButton, false, "Removing…");
    }
  });

  elements.logoutButton?.addEventListener("click", async () => {
    try {
      await request("/api/location/manage", {
        method: "POST",
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      state.coordinates = null;
      showLogin("Signed out.", "success");
    }
  });

  void loadDashboard();
})();
