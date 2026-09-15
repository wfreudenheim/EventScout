import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Location, Event, InterestProfile, AgentRun } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

function dataPath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

async function readJson<T>(filename: string): Promise<T> {
  const content = await readFile(dataPath(filename), "utf-8");
  return JSON.parse(content) as T;
}

async function writeJson<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  await writeFile(dataPath(filename), JSON.stringify(data, null, 2), "utf-8");
}

// === Locations ===

export async function loadLocations(): Promise<Location[]> {
  try {
    return await readJson<Location[]>("locations.json");
  } catch {
    return [];
  }
}

export async function saveLocations(locations: Location[]): Promise<void> {
  await writeJson("locations.json", locations);
}

export async function getLocation(id: string): Promise<Location | undefined> {
  const locations = await loadLocations();
  return locations.find((l) => l.id === id);
}

// === Events ===

export async function loadEvents(): Promise<Event[]> {
  try {
    return await readJson<Event[]>("events.json");
  } catch {
    return [];
  }
}

export async function saveEvents(events: Event[]): Promise<void> {
  await writeJson("events.json", events);
}

export async function loadStagedEvents(): Promise<Event[]> {
  try {
    return await readJson<Event[]>("staged_events.json");
  } catch {
    return [];
  }
}

export async function saveStagedEvents(events: Event[]): Promise<void> {
  await writeJson("staged_events.json", events);
}

// === Interest Profile ===

export async function loadInterestProfile(): Promise<InterestProfile> {
  return await readJson<InterestProfile>("interest_profile.json");
}

// === Agent Log ===

export async function loadAgentLog(): Promise<AgentRun[]> {
  try {
    return await readJson<AgentRun[]>("agent_log.json");
  } catch {
    return [];
  }
}

export async function appendAgentLog(run: AgentRun): Promise<void> {
  const log = await loadAgentLog();
  log.push(run);
  // Keep last 500 entries
  const trimmed = log.slice(-500);
  await writeJson("agent_log.json", trimmed);
}

// === Deduplication ===

export function deduplicateEvents(
  existing: Event[],
  incoming: Event[]
): { newEvents: Event[]; updatedEvents: Event[] } {
  const newEvents: Event[] = [];
  const updatedEvents: Event[] = [];

  for (const event of incoming) {
    const match = existing.find(
      (e) =>
        e.venue_id === event.venue_id &&
        e.date === event.date &&
        titlesMatch(e.title, event.title)
    );

    if (match) {
      // Update if the incoming event has more info
      if (
        event.description &&
        (!match.description || event.description.length > match.description.length)
      ) {
        Object.assign(match, event, { id: match.id, status: match.status });
        updatedEvents.push(match);
      }
    } else {
      newEvents.push(event);
    }
  }

  return { newEvents, updatedEvents };
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Cross-source title matching: exact after normalization, or containment for
 * distinctive titles — catches "Perfect Blue" vs "Perfect Blue (35mm)" when
 * the same event arrives from a venue page and an aggregator.
 */
function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return shorter.length >= 10 && longer.includes(shorter);
}

// === ID Generation ===

export function generateEventId(venueId: string, date: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  return `${venueId}-${date}-${slug}`;
}
