/**
 * Tier 3 Parser — Utility functions for Claude-powered event parsing.
 *
 * In Tier 3 mode, Claude Code reads venue HTML directly and extracts events
 * using its own intelligence. This module provides the bookkeeping:
 * - Loading venue context and interest profile
 * - Accepting parsed events from Claude's analysis
 * - Scoring, deduplicating, and staging results
 * - Logging the agent run
 *
 * The actual parsing intelligence is Claude itself — not code in this file.
 */

import type { Location, Event, AgentRun, InterestProfile } from "../types/index.js";
import {
  loadLocations,
  loadInterestProfile,
  loadStagedEvents,
  saveStagedEvents,
  loadEvents,
  saveLocations,
  deduplicateEvents,
  appendAgentLog,
  generateEventId,
} from "../utils/data.js";
import { scoreEvent, inferFormat } from "../utils/scoring.js";

export interface RawParsedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  time_start?: string; // HH:MM
  time_end?: string; // HH:MM
  description?: string;
  url?: string;
  price?: string;
  venue_name?: string; // Aggregator parses: name of the hosting venue
  // Claude-provided scoring (Tier 3 — Claude judges relevance during extraction)
  interest_score?: number; // 0-5, provided by Claude based on interest profile
  matched_categories?: string[]; // Interest categories Claude thinks match
  format?: string; // Event format Claude inferred
}

export interface ProcessOptions {
  sourceAgent?: string; // e.g. "aggregator:screen-slate", "tier1-eventbrite", "tier2-scraper"
  agentType?: "venue-agent" | "aggregator-agent";
  scrapeTier?: 1 | 2 | 3;
}

export interface Tier3Context {
  location: Location;
  profile: InterestProfile;
  existingEventCount: number;
}

/**
 * Prepare context for a Tier 3 parse. Returns the venue info and interest
 * profile so Claude knows what to look for.
 */
export async function prepareTier3Context(
  venueQuery: string
): Promise<Tier3Context> {
  const locations = await loadLocations();
  const location = locations.find(
    (l) =>
      l.name.toLowerCase() === venueQuery.toLowerCase() ||
      l.id === venueQuery.toLowerCase().replace(/\s+/g, "-") ||
      l.name.toLowerCase().includes(venueQuery.toLowerCase())
  );

  if (!location) {
    throw new Error(
      `Venue not found: "${venueQuery}". Available venues:\n${locations
        .map((l) => `  - ${l.name} (${l.id})`)
        .join("\n")}`
    );
  }

  const profile = await loadInterestProfile();
  const existing = await loadEvents();
  const staged = await loadStagedEvents();

  return {
    location,
    profile,
    existingEventCount: existing.length + staged.length,
  };
}

/**
 * Process raw events that Claude extracted from a venue page.
 * Scores them, deduplicates, and writes to staging.
 */
export async function processParsedEvents(
  locationId: string,
  locationName: string,
  rawEvents: RawParsedEvent[],
  options: ProcessOptions = {}
): Promise<{ total: number; newCount: number; duplicates: number; dropped: number }> {
  const profile = await loadInterestProfile();
  const minScore = profile.min_score_to_stage ?? 1;

  // Score and structure each event.
  // Prefer Claude-provided scores/categories from Tier 3 parsing.
  // Fall back to keyword scoring if Claude didn't provide them.
  const allEvents: Event[] = rawEvents.map((raw) => {
    const keywordResult = scoreEvent(raw.title, raw.description || "", profile);
    const format = (raw.format as Event["format"]) || inferFormat(raw.title, raw.description || "");

    // Use Claude's score if provided, otherwise fall back to keyword scoring.
    // Take the max of both when Claude scored — Claude has context, keywords catch specifics.
    const finalScore = raw.interest_score != null
      ? Math.max(raw.interest_score, keywordResult.score)
      : keywordResult.score;

    const finalCategories = raw.matched_categories && raw.matched_categories.length > 0
      ? [...new Set([...raw.matched_categories, ...keywordResult.matchedCategories])]
      : keywordResult.matchedCategories;

    return {
      id: generateEventId(locationId, raw.date, raw.title),
      title: raw.title,
      venue_id: locationId,
      venue_name: locationName,
      date: raw.date,
      time_start: raw.time_start,
      time_end: raw.time_end,
      description: raw.description?.slice(0, 500),
      url: raw.url,
      price: raw.price,
      format,
      interest_score: finalScore,
      tags: keywordResult.tags,
      matched_categories: finalCategories,
      source_agent: options.sourceAgent ?? "tier3-claude",
      status: "staged",
      discovered_at: new Date().toISOString(),
    };
  });

  // Drop events below the score floor — these are truly irrelevant
  const aboveFloor = allEvents.filter((e) => e.interest_score >= minScore);

  // Cap per venue — sort by score descending, take top N
  const maxPerVenue = profile.max_events_per_venue ?? 12;
  const events = aboveFloor
    .sort((a, b) => b.interest_score - a.interest_score || a.date.localeCompare(b.date))
    .slice(0, maxPerVenue);

  const dropped = allEvents.length - events.length;

  // Deduplicate against existing
  const existingStaged = await loadStagedEvents();
  const existingApproved = await loadEvents();
  const allExisting = [...existingStaged, ...existingApproved];
  const { newEvents } = deduplicateEvents(allExisting, events);

  // Add to staging
  if (newEvents.length > 0) {
    const staged = await loadStagedEvents();
    staged.push(...newEvents);
    await saveStagedEvents(staged);
  }

  // Update last_checked
  const locations = await loadLocations();
  const loc = locations.find((l) => l.id === locationId);
  if (loc) {
    loc.last_checked = new Date().toISOString();
    await saveLocations(locations);
  }

  // Log the run
  const agentRun: AgentRun = {
    agent_type: options.agentType ?? "venue-agent",
    target_id: locationId,
    scrape_tier_used: options.scrapeTier ?? 3,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    events_found: events.length,
    events_new: newEvents.length,
    status: "completed",
  };
  await appendAgentLog(agentRun);

  return {
    total: allEvents.length,
    newCount: newEvents.length,
    duplicates: events.length - newEvents.length,
    dropped,
  };
}

/**
 * Format a summary of processing results for display.
 */
export function formatProcessingSummary(
  venueName: string,
  result: { total: number; newCount: number; duplicates: number; dropped: number }
): string {
  const lines = [
    `\n=== ${venueName} — Tier 3 Parse Complete ===`,
    `Events found: ${result.total}`,
    `New (staged): ${result.newCount}`,
    `Duplicates skipped: ${result.duplicates}`,
  ];
  if (result.dropped > 0) {
    lines.push(`Below score floor: ${result.dropped}`);
  }
  if (result.newCount > 0) {
    lines.push(`\nRun 'scout review' to see staged events.`);
  }
  return lines.join("\n");
}
