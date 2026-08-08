import ical, { type ParameterValue, type VEvent } from "node-ical";

const CALENDAR_TIMEZONE = "America/Chicago";
const MAX_CALENDAR_BYTES = 2_000_000;
const MAX_PUBLIC_EVENTS = 6;
const HORIZON_DAYS = 180;

export type PublicCalendarEvent = {
  id: string;
  title: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  detailsUrl: string | null;
  detailsLabel: "Event details" | "Get directions" | null;
};

function parameterText(value: ParameterValue | undefined) {
  if (!value) return "";
  return (typeof value === "string" ? value : value.val).trim();
}

function safeHttpsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function createDirectionsUrl(location: string) {
  if (!location) return null;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", location);
  return url.toString();
}

function fallbackInstance(event: VEvent) {
  const allDay = event.datetype === "date" || event.start.dateOnly === true;
  const defaultDuration = allDay ? 86_400_000 : 3_600_000;
  return [{
    start: event.start,
    end: event.end ?? new Date(event.start.getTime() + defaultDuration),
    summary: event.summary,
    isFullDay: allDay,
    event,
  }];
}

export async function parseCalendarEvents(icsText: string, now = new Date()): Promise<PublicCalendarEvent[]> {
  const parsed = await ical.async.parseICS(icsText);
  const rangeStart = new Date(now.getTime() - 86_400_000);
  const rangeEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
  const events: PublicCalendarEvent[] = [];

  for (const component of Object.values(parsed)) {
    if (!component || component.type !== "VEVENT" || component.status === "CANCELLED") continue;

    let instances;
    try {
      instances = ical.expandRecurringEvent(component, {
        from: rangeStart,
        to: rangeEnd,
        includeOverrides: true,
        excludeExdates: true,
        expandOngoing: true,
      });
    } catch {
      instances = fallbackInstance(component);
    }

    for (const instance of instances) {
      const source = instance.event;
      if (source.status === "CANCELLED") continue;

      const start = new Date(instance.start);
      const end = new Date(instance.end);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
      if (end.getTime() < now.getTime() || start.getTime() > rangeEnd.getTime()) continue;

      const title = parameterText(source.summary ?? instance.summary) || "Big Papa's stop";
      const location = parameterText(source.location);
      const eventUrl = safeHttpsUrl(source.url);
      const directionsUrl = createDirectionsUrl(location);

      events.push({
        id: `${source.uid}:${start.toISOString()}`,
        title,
        location,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: instance.isFullDay,
        detailsUrl: eventUrl ?? directionsUrl,
        detailsLabel: eventUrl ? "Event details" : directionsUrl ? "Get directions" : null,
      });
    }
  }

  const uniqueEvents = new Map(events.map((event) => [event.id, event]));
  return [...uniqueEvents.values()]
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start))
    .slice(0, MAX_PUBLIC_EVENTS);
}

function getCalendarUrl() {
  const value = process.env.GOOGLE_CALENDAR_ICS_URL?.trim();
  if (!value) return null;

  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "calendar.google.com") {
    throw new Error("GOOGLE_CALENDAR_ICS_URL must be a Google Calendar HTTPS address.");
  }
  return url;
}

export async function readUpcomingCalendarEvents() {
  const calendarUrl = getCalendarUrl();
  if (!calendarUrl) return { configured: false, events: [] as PublicCalendarEvent[] };

  const response = await fetch(calendarUrl, {
    headers: {
      Accept: "text/calendar",
      "User-Agent": "Big-Papas-Website/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error(`Google Calendar returned ${response.status}.`);

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CALENDAR_BYTES) {
    throw new Error("Google Calendar response was larger than expected.");
  }

  const icsText = await response.text();
  if (Buffer.byteLength(icsText, "utf8") > MAX_CALENDAR_BYTES) {
    throw new Error("Google Calendar response was larger than expected.");
  }

  return { configured: true, events: await parseCalendarEvents(icsText) };
}

export { CALENDAR_TIMEZONE };
