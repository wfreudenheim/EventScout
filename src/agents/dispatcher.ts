import type { Location, Event, AgentRun } from "../types/index.js";
import {
  loadLocations,
  loadStagedEvents,
  saveStagedEvents,
  saveLocations,
  deduplicateEvents,
  loadEvents,
  appendAgentLog,
} from "../utils/data.js";
import { runVenueAgent } from "./venue-agent.js";

export interface DispatchResult {
  totalVenues: number;
  totalEventsFound: number;
  totalNewEvents: number;
  errors: string[];
}

export async function dispatchAll(): Promise<DispatchResult> {
  const locations = await loadLocations();
  const activeLocations = locations.filter((l) => l.status === "active");

  console.log(`\nDispatching agents for ${activeLocations.length} active locations...\n`);

  const result: DispatchResult = {
    totalVenues: activeLocations.length,
    totalEventsFound: 0,
    totalNewEvents: 0,
    errors: [],
  };

  // Process venues sequentially to be respectful of rate limits
  for (const location of activeLocations) {
    try {
      await dispatchForLocation(location, result);
    } catch (err) {
      const msg = `${location.name}: ${err instanceof Error ? err.message : err}`;
      console.error(`  ERROR: ${msg}`);
      result.errors.push(msg);
    }

    // Small delay between venues to be polite
    await sleep(1000);
  }

  return result;
}

export async function dispatchForVenue(venueName: string): Promise<DispatchResult> {
  const locations = await loadLocations();
  const location = locations.find(
    (l) =>
      l.name.toLowerCase() === venueName.toLowerCase() ||
      l.id === venueName.toLowerCase().replace(/\s+/g, "-")
  );

  if (!location) {
    throw new Error(`Venue not found: "${venueName}". Use 'scout locations' to see all venues.`);
  }

  console.log(`\nDispatching agent for ${location.name}...\n`);

  const result: DispatchResult = {
    totalVenues: 1,
    totalEventsFound: 0,
    totalNewEvents: 0,
    errors: [],
  };

  await dispatchForLocation(location, result);
  return result;
}

async function dispatchForLocation(
  location: Location,
  result: DispatchResult
): Promise<void> {
  console.log(`[${location.name}] (${location.entity_type})`);

  const agentRun: AgentRun = {
    agent_type: "venue-agent",
    target_id: location.id,
    started_at: new Date().toISOString(),
    events_found: 0,
    events_new: 0,
    status: "running",
  };

  try {
    const foundEvents = await runVenueAgent(location);
    agentRun.events_found = foundEvents.length;
    result.totalEventsFound += foundEvents.length;

    // Deduplicate against existing staged + approved events
    const existingStaged = await loadStagedEvents();
    const existingApproved = await loadEvents();
    const allExisting = [...existingStaged, ...existingApproved];

    const { newEvents } = deduplicateEvents(allExisting, foundEvents);
    agentRun.events_new = newEvents.length;
    result.totalNewEvents += newEvents.length;

    // Add new events to staging
    if (newEvents.length > 0) {
      const staged = await loadStagedEvents();
      staged.push(...newEvents);
      await saveStagedEvents(staged);
    }

    // Update last_checked on the location
    const locations = await loadLocations();
    const loc = locations.find((l) => l.id === location.id);
    if (loc) {
      loc.last_checked = new Date().toISOString();
      await saveLocations(locations);
    }

    agentRun.status = "completed";
    agentRun.completed_at = new Date().toISOString();

    console.log(
      `  → ${foundEvents.length} events found, ${newEvents.length} new → staged\n`
    );
  } catch (err) {
    agentRun.status = "failed";
    agentRun.error = err instanceof Error ? err.message : String(err);
    agentRun.completed_at = new Date().toISOString();
    throw err;
  } finally {
    await appendAgentLog(agentRun);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
