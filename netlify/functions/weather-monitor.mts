import { readUpcomingCalendarEvents } from "../lib/calendar.mjs";
import { readEventPlannerState } from "../lib/events.mjs";
import { collectWeatherEvents, getWeatherSnapshot, monitorWeather } from "../lib/weather.mjs";

export default async function handler() {
  try {
    const [calendar, planner] = await Promise.all([
      readUpcomingCalendarEvents({ limit: 30 }).catch(() => ({ configured: true, events: [] })),
      readEventPlannerState(),
    ]);
    const events = collectWeatherEvents(calendar.events, planner.events);
    const snapshot = await getWeatherSnapshot(events);
    const sent = await monitorWeather(snapshot);
    console.log(JSON.stringify({ checked: snapshot.events.length, alertsSent: sent.length }));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Weather monitor failed", error);
    return new Response(null, { status: 500 });
  }
}
