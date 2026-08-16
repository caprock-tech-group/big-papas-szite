(() => {
  "use strict";

  const root = document.querySelector("[data-calendar-events]");
  if (!root) return;

  const grid = root.querySelector("[data-calendar-grid]");
  const empty = root.querySelector("[data-calendar-empty]");
  const status = root.querySelector("[data-calendar-status]");
  if (!grid) return;

  const timezone = "America/Chicago";
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const media = [
    {
      src: "/images/big-hoss-hero.webp",
      alt: "Big Papa's brisket-loaded baked potato",
      position: "center",
      branded: false,
    },
    {
      src: "/images/loaded-potato-lineup.webp",
      alt: "A lineup of Big Papa's loaded baked potatoes",
      position: "43% center",
      branded: false,
    },
    {
      src: "/images/big-papas-logo.webp",
      alt: "Big Papa's Texas Loaded Potatoes logo",
      position: "center",
      branded: true,
    },
  ];

  const calendarIcon = '<svg class="icon icon--calendar" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';
  const clockIcon = '<svg class="icon icon--clock" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>';
  const pinIcon = '<svg class="icon icon--map-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const arrowIcon = '<svg class="icon icon--arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const monthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short" });
  const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "2-digit" });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function isPublicEvent(event) {
    return event
      && typeof event.id === "string"
      && typeof event.title === "string"
      && typeof event.start === "string"
      && typeof event.end === "string"
      && Number.isFinite(Date.parse(event.start))
      && Number.isFinite(Date.parse(event.end));
  }

  function eventDate(event, value) {
    if (event.allDay && dateOnlyPattern.test(value)) {
      return new Date(`${value}T12:00:00.000Z`);
    }
    return new Date(value);
  }

  function dateKeyInCalendarTimezone(value) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return year && month && day ? `${year}-${month}-${day}` : "";
  }

  function formatTimeRange(event, start, end) {
    if (event.allDay) return "All day";
    return `${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  }

  function buildCard(event, index) {
    const start = eventDate(event, event.start);
    const end = eventDate(event, event.end);
    const cardMedia = media[index % media.length];
    const card = document.createElement("article");
    card.className = "schedule-card";
    card.dataset.calendarCard = "true";
    card.dataset.calendarEnd = event.end;
    card.dataset.calendarAllDay = event.allDay ? "true" : "false";
    card.innerHTML = `
      <div class="schedule-card__cover${cardMedia.branded ? " schedule-card__cover--brand" : ""}">
        <img width="1774" height="887" loading="lazy">
        <span class="schedule-card__wash" aria-hidden="true"></span>
        <time class="schedule-card__date"><span></span><strong></strong></time>
        <span class="schedule-card__source">Calendar event</span>
      </div>
      <div class="schedule-card__body">
        <h3></h3>
        <div class="schedule-card__meta">
          <p>${calendarIcon}<span><strong></strong><small>${clockIcon}<span></span></small></span></p>
          <p class="schedule-card__location">${pinIcon}<span></span></p>
        </div>
        <a class="schedule-card__link" target="_blank" rel="noreferrer noopener"><span></span>${arrowIcon}</a>
      </div>`;

    const image = card.querySelector("img");
    image.src = cardMedia.src;
    image.alt = cardMedia.alt;
    image.style.objectPosition = cardMedia.position;

    const date = card.querySelector("time");
    date.dateTime = event.start;
    setText(date.querySelector("span"), monthFormatter.format(start));
    setText(date.querySelector("strong"), dayFormatter.format(start));
    setText(card.querySelector("h3"), event.title.trim() || "Big Papa's stop");
    setText(card.querySelector(".schedule-card__meta p strong"), dateFormatter.format(start));
    setText(card.querySelector(".schedule-card__meta p small span"), formatTimeRange(event, start, end));

    const locationRow = card.querySelector(".schedule-card__location");
    const location = typeof event.location === "string" ? event.location.trim() : "";
    if (location) setText(locationRow.querySelector("span"), location);
    else locationRow.remove();

    const link = card.querySelector(".schedule-card__link");
    if (typeof event.detailsUrl === "string" && event.detailsUrl.startsWith("https://")) {
      link.href = event.detailsUrl;
      setText(link.querySelector("span"), event.detailsLabel || "Event details");
    } else {
      link.remove();
    }

    return card;
  }

  function showEvents(events) {
    const cards = events.map(buildCard);
    grid.replaceChildren(...cards);
    grid.hidden = cards.length === 0;
    if (empty) empty.hidden = cards.length !== 0;
  }

  function pruneExpiredFallback() {
    const now = Date.now();
    const today = dateKeyInCalendarTimezone(new Date(now));
    for (const card of grid.querySelectorAll("[data-calendar-card]")) {
      const endValue = card.dataset.calendarEnd || "";
      const expired = card.dataset.calendarAllDay === "true" && dateOnlyPattern.test(endValue)
        ? Boolean(today) && endValue <= today
        : Number.isFinite(Date.parse(endValue)) && Date.parse(endValue) < now;
      if (expired) card.remove();
    }
    const hasCards = grid.querySelector("[data-calendar-card]") !== null;
    grid.hidden = !hasCards;
    if (empty) empty.hidden = hasCards;
  }

  async function refreshCalendar() {
    try {
      const response = await fetch("/api/calendar", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Calendar service unavailable");
      const result = await response.json();

      if (!result.configured) {
        setText(status, "Google Calendar schedule");
        return;
      }

      const events = Array.isArray(result.events) ? result.events.filter(isPublicEvent) : [];
      showEvents(events);
      setText(status, "Synced with Google Calendar");
    } catch {
      pruneExpiredFallback();
      setText(status, "Latest saved schedule");
    }
  }

  pruneExpiredFallback();
  void refreshCalendar();
  window.setInterval(refreshCalendar, 300_000);
})();
