(() => {
  "use strict";

  const root = document.querySelector("[data-live-location]");
  if (!root) return;

  const elements = {
    map: root.querySelector("[data-live-map]"),
    placeholder: root.querySelector("[data-live-placeholder]"),
    frame: root.querySelector("[data-live-map-frame]"),
    mapBadge: root.querySelector("[data-live-map-badge]"),
    title: root.querySelector("[data-live-title]"),
    summary: root.querySelector("[data-live-summary]"),
    card: root.querySelector("[data-live-card]"),
    kicker: root.querySelector("[data-live-kicker]"),
    place: root.querySelector("[data-live-place]"),
    updated: root.querySelector("[data-live-updated]"),
    details: root.querySelector("[data-live-details]"),
    hours: root.querySelector("[data-live-hours]"),
    note: root.querySelector("[data-live-note]"),
    directions: root.querySelector("[data-live-directions]"),
  };

  const defaultCopy = {
    title: "Catch us when we roll into town.",
    summary:
      "When we're parked and serving, our live pin appears here. Check Facebook for upcoming stops, service times, and sellout updates.",
    place: "Waiting for today's stop",
    updated: "Serving Claude, Amarillo & the Texas Panhandle",
  };

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function setOptionalText(element, value) {
    if (!element) return;
    const text = typeof value === "string" ? value.trim() : "";
    element.textContent = text;
    element.hidden = !text;
  }

  function createMapUrl(latitude, longitude) {
    const url = new URL("https://www.openstreetmap.org/export/embed.html");
    const latitudeDelta = 0.008;
    const longitudeDelta = 0.011;
    url.searchParams.set(
      "bbox",
      [
        longitude - longitudeDelta,
        latitude - latitudeDelta,
        longitude + longitudeDelta,
        latitude + latitudeDelta,
      ].join(","),
    );
    url.searchParams.set("layer", "mapnik");
    url.searchParams.set("marker", `${latitude},${longitude}`);
    return url.toString();
  }

  function createDirectionsUrl(latitude, longitude) {
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("destination", `${latitude},${longitude}`);
    return url.toString();
  }

  function formatUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Location posted recently";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `Updated ${formatter.format(date)}`;
  }

  function renderOffline() {
    setText(elements.title, defaultCopy.title);
    setText(elements.summary, defaultCopy.summary);
    setText(elements.kicker, "Current status");
    setText(elements.place, defaultCopy.place);
    setText(elements.updated, defaultCopy.updated);
    elements.card?.classList.remove("is-live");
    if (elements.placeholder) elements.placeholder.hidden = false;
    if (elements.frame) {
      elements.frame.hidden = true;
      elements.frame.removeAttribute("src");
    }
    if (elements.mapBadge) elements.mapBadge.hidden = true;
    if (elements.details) elements.details.hidden = true;
    if (elements.directions) elements.directions.hidden = true;
  }

  function renderLive(location) {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      renderOffline();
      return;
    }

    const place = location.locationName?.trim() || "Big Papa's is parked and serving";
    setText(elements.title, "We're parked. Come get loaded.");
    setText(elements.summary, "The live pin below is our current service location. Tap directions and we'll see you there.");
    setText(elements.kicker, "Live location");
    setText(elements.place, place);
    setText(elements.updated, formatUpdatedAt(location.updatedAt));
    elements.card?.classList.add("is-live");

    setOptionalText(elements.hours, location.hours);
    setOptionalText(elements.note, location.note);
    if (elements.details) {
      elements.details.hidden = !location.hours?.trim() && !location.note?.trim();
    }

    if (elements.frame) {
      elements.frame.src = createMapUrl(latitude, longitude);
      elements.frame.hidden = false;
    }
    if (elements.placeholder) elements.placeholder.hidden = true;
    if (elements.mapBadge) elements.mapBadge.hidden = false;
    if (elements.directions) {
      elements.directions.href = createDirectionsUrl(latitude, longitude);
      elements.directions.hidden = false;
    }
  }

  async function refreshLocation() {
    try {
      const response = await fetch("/api/location", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Location service unavailable");
      const result = await response.json();
      if (result.live && result.location) renderLive(result.location);
      else renderOffline();
    } catch {
      renderOffline();
    }
  }

  renderOffline();
  void refreshLocation();
  window.setInterval(refreshLocation, 60_000);
})();
