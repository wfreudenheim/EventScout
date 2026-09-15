/**
 * Ingest events parsed from an aggregator page (Screen Slate, Thought Gallery,
 * cal.red, NYC Noise). Each event carries a venue_name; this script matches
 * venue names to the registry, ingests matched events per-venue, and reports
 * unmatched venues as candidates for the registry.
 *
 * Usage:
 *   npx tsx src/scripts/ingest-aggregator.ts <aggregator-id> <json-file> [--create-pending]
 *
 * --create-pending: stage events at unknown venues by creating pending
 *   registry entries (added_by: "aggregator", status: "pending") instead of
 *   skipping them.
 */

import { readFile } from "fs/promises";
import {
  processParsedEvents,
  type RawParsedEvent,
} from "../agents/tier3-parser.js";
import { loadLocations, saveLocations } from "../utils/data.js";
import { matchVenue, buildPendingLocation } from "../utils/venues.js";

async function main() {
  const args = process.argv.slice(2);
  const createPending = args.includes("--create-pending");
  const [aggregatorId, jsonFile] = args.filter((a) => !a.startsWith("--"));

  if (!aggregatorId || !jsonFile) {
    console.error(
      "Usage: npx tsx src/scripts/ingest-aggregator.ts <aggregator-id> <json-file> [--create-pending]"
    );
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(jsonFile, "utf-8")) as RawParsedEvent[];
  const locations = await loadLocations();

  // Group events by matched venue
  const byVenue = new Map<string, RawParsedEvent[]>();
  const unmatched = new Map<string, RawParsedEvent[]>();
  const weakMatches: string[] = [];

  for (const event of raw) {
    const venueName = event.venue_name?.trim();
    if (!venueName) {
      const group = unmatched.get("(no venue listed)") ?? [];
      group.push(event);
      unmatched.set("(no venue listed)", group);
      continue;
    }

    const match = matchVenue(venueName, locations);
    if (match) {
      if (match.confidence === "weak") {
        weakMatches.push(`"${venueName}" -> ${match.location.name}`);
      }
      const group = byVenue.get(match.location.id) ?? [];
      group.push(event);
      byVenue.set(match.location.id, group);
    } else {
      const group = unmatched.get(venueName) ?? [];
      group.push(event);
      unmatched.set(venueName, group);
    }
  }

  // Optionally create pending registry entries for unknown venues
  if (createPending) {
    for (const [venueName, events] of [...unmatched]) {
      if (venueName === "(no venue listed)") continue;
      const pending = buildPendingLocation(venueName);
      if (!locations.find((l) => l.id === pending.id)) {
        locations.push(pending);
        console.log(`Created pending venue: ${pending.name} (${pending.id})`);
      }
      byVenue.set(pending.id, events);
      unmatched.delete(venueName);
    }
    await saveLocations(locations);
  }

  // Ingest per matched venue (sequentially — shared JSON files)
  console.log(
    `\n=== Aggregator ingest: ${aggregatorId} — ${raw.length} events, ${byVenue.size} venues matched ===`
  );
  let staged = 0;
  for (const [venueId, events] of byVenue) {
    const loc = locations.find((l) => l.id === venueId)!;
    const result = await processParsedEvents(loc.id, loc.name, events, {
      sourceAgent: `aggregator:${aggregatorId}`,
      agentType: "aggregator-agent",
    });
    staged += result.newCount;
    console.log(
      `  ${loc.name}: ${events.length} events -> ${result.newCount} new, ${result.duplicates} dup, ${result.dropped} dropped`
    );
  }

  if (weakMatches.length > 0) {
    console.log(`\nWeak venue matches (verify these):`);
    for (const w of [...new Set(weakMatches)]) console.log(`  ${w}`);
  }

  if (unmatched.size > 0) {
    console.log(`\nUnmatched venues (${unmatched.size}) — not ingested:`);
    for (const [venueName, events] of unmatched) {
      console.log(`  ${venueName} (${events.length} events)`);
      for (const e of events.slice(0, 3)) {
        console.log(`    - [${e.date}] ${e.title}`);
      }
    }
    console.log(
      `\nRe-run with --create-pending to stage these under pending venue entries,`
    );
    console.log(`or add venues properly via 'scout add-venue'.`);
  }

  console.log(`\nTotal newly staged: ${staged}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
