import assert from "node:assert/strict";
import { mock, test } from "node:test";

const stored = new Map();
mock.module("@netlify/blobs", {
  namedExports: {
    getStore: () => ({
      get: async (key) => structuredClone(stored.get(key) ?? null),
      setJSON: async (key, value) => { stored.set(key, structuredClone(value)); },
    }),
  },
});

const {
  calendarEventToWeatherInput,
  chicagoLocalDateTime,
  normalizeWeatherSettings,
  scoreWeatherWindow,
  weatherAlertDecision,
} = await import("../netlify/lib/weather.mts");

const calmHour = {
  time: "2026-10-12T18:00",
  temperature: 72,
  apparentTemperature: 72,
  precipitationProbability: 10,
  precipitation: 0,
  windSpeed: 8,
  windGust: 13,
  weatherCode: 1,
  conditions: "Mostly clear",
};

test("weather settings keep safe ordering and bounds", () => {
  assert.deepEqual(normalizeWeatherSettings({
    alertsEnabled: false,
    windWatch: 30,
    windHigh: 20,
    rainWatch: 80,
    rainHigh: 20,
    heatWatch: 105,
    heatHigh: 90,
    coldWatch: 30,
    coldHigh: 45,
  }), {
    version: 1,
    alertsEnabled: false,
    windWatch: 30,
    windHigh: 30,
    rainWatch: 80,
    rainHigh: 80,
    heatWatch: 105,
    heatHigh: 105,
    coldWatch: 30,
    coldHigh: 30,
  });
});

test("planner-style local event times preserve Central time across daylight saving", () => {
  assert.equal(chicagoLocalDateTime("2026-07-04", "18:00").toISOString(), "2026-07-04T23:00:00.000Z");
  assert.equal(chicagoLocalDateTime("2026-12-04", "18:00").toISOString(), "2026-12-05T00:00:00.000Z");
});

test("all-day calendar events stay on their calendar date and use a useful daytime window", () => {
  const event = calendarEventToWeatherInput({
    id: "picnic",
    title: "Community picnic",
    location: "Claude City Park, Claude, TX",
    start: "2026-10-17",
    end: "2026-10-18",
    allDay: true,
    detailsUrl: null,
    detailsLabel: null,
  });
  assert.equal(event.start, "2026-10-17T14:00:00.000Z");
  assert.equal(event.end, "2026-10-18T02:00:00.000Z");
});

test("risk scoring separates ordinary, planning, and severe conditions", () => {
  assert.equal(scoreWeatherWindow([calmHour], []).risk, "good");
  const windy = { ...calmHour, windGust: 38, precipitationProbability: 75 };
  const high = scoreWeatherWindow([windy], []);
  assert.equal(high.risk, "high");
  assert.match(high.reasons.join(" "), /38 mph/);
  const severe = scoreWeatherWindow([windy], [{ id: "1", event: "Tornado Warning", severity: "Extreme", urgency: "Immediate", headline: "Tornado Warning", onset: null, ends: null, expires: null }]);
  assert.equal(severe.risk, "severe");
});

test("alert decisions notify on risk milestones, avoid duplicates, and send one all-clear", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  const event = {
    id: "calendar:1",
    source: "calendar",
    sourceId: "1",
    title: "Friday stop",
    location: "Amarillo, TX",
    resolvedLocation: "Amarillo, TX",
    start: "2026-10-09T18:00:00.000Z",
    end: "2026-10-09T21:00:00.000Z",
    allDay: false,
    risk: "high",
    riskScore: 2,
    reasons: ["Wind gusts may reach 38 mph"],
    recommendation: "Prepare a backup plan.",
    summary: "Windy",
    temperature: 70,
    apparentTemperature: 70,
    highTemperature: 72,
    lowTemperature: 65,
    precipitationProbability: 20,
    windSpeed: 25,
    windGust: 38,
    conditions: "Windy",
    hourly: [calmHour],
    alerts: [],
    forecastSource: "NWS",
    confidence: "high",
    updatedAt: now.toISOString(),
    availableAt: null,
    locationNeedsAttention: false,
  };
  const first = weatherAlertDecision(event, undefined, now);
  assert.equal(first.send, true);
  const previous = { lastRisk: "high", lastScore: 2, milestones: [first.milestone], lastFingerprint: first.fingerprint, lastSentAt: now.toISOString(), allClearSent: false };
  assert.equal(weatherAlertDecision(event, previous, now).send, false);
  const clear = { ...event, risk: "good", riskScore: 0, reasons: [], summary: "Clear" };
  assert.equal(weatherAlertDecision(clear, previous, now).kind, "clear");
  assert.equal(weatherAlertDecision(clear, { ...previous, lastRisk: "good", lastScore: 0, allClearSent: true }, now).send, false);
});
