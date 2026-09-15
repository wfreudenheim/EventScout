import type { Event, Location } from "./types";

let cachedEvents: Event[] | null = null;
let cachedLocations: Location[] | null = null;

export async function loadEvents(): Promise<Event[]> {
  if (cachedEvents) return cachedEvents;
  const [staged, approved] = await Promise.all([
    fetchJson<Event[]>("data/staged_events.json"),
    fetchJson<Event[]>("data/events.json"),
  ]);
  cachedEvents = [...approved, ...staged];
  return cachedEvents;
}

export async function loadLocations(): Promise<Location[]> {
  if (cachedLocations) return cachedLocations;
  cachedLocations = await fetchJson<Location[]>("data/locations.json");
  return cachedLocations;
}

async function fetchJson<T>(path: string): Promise<T> {
  // Relative to the deploy base so it works at / (dev) and /EventScout/ (GitHub Pages)
  const res = await fetch(import.meta.env.BASE_URL + path);
  if (!res.ok) return [] as unknown as T;
  return res.json();
}

export function buildGoogleCalendarUrl(event: Event, location?: Location): string {
  const title = encodeURIComponent(event.title);
  const startDate = event.date.replace(/-/g, "");
  const startTime = event.time_start?.replace(":", "") || "000000";
  const endTime = event.time_end?.replace(":", "") || "";

  const dtStart = `${startDate}T${startTime}00`;
  const dtEnd = endTime
    ? `${startDate}T${endTime}00`
    : `${startDate}T${String(Number(startTime.slice(0, 2)) + 2).padStart(2, "0")}${startTime.slice(2)}00`;

  const locationStr = location?.address
    ? encodeURIComponent(`${location.name}, ${location.address}`)
    : encodeURIComponent(event.venue_name || "");

  const details = encodeURIComponent(
    `${event.description || ""}\n\n${event.url || ""}`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&location=${locationStr}&details=${details}`;
}

export function getNeighborhoods(locations: Location[]): string[] {
  const hoods = new Set<string>();
  for (const loc of locations) {
    if (loc.neighborhood) hoods.add(loc.neighborhood);
  }
  return [...hoods].sort();
}

export function getFormats(events: Event[]): string[] {
  const formats = new Set<string>();
  for (const ev of events) {
    if (ev.format) formats.add(ev.format);
  }
  return [...formats].sort();
}

export function getCategories(events: Event[]): string[] {
  const cats = new Set<string>();
  for (const ev of events) {
    for (const cat of ev.matched_categories) {
      cats.add(cat);
    }
  }
  return [...cats].sort();
}
