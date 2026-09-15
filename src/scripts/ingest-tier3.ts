/**
 * Helper script to ingest Tier 3 parsed events from a JSON file or stdin.
 * Usage: npx tsx src/scripts/ingest-tier3.ts <venue-id> <json-file>
 */

import { readFile } from "fs/promises";
import {
  processParsedEvents,
  formatProcessingSummary,
  type RawParsedEvent,
} from "../agents/tier3-parser.js";
import { loadLocations } from "../utils/data.js";

async function main() {
  const venueId = process.argv[2];
  const jsonFile = process.argv[3];

  if (!venueId || !jsonFile) {
    console.error("Usage: npx tsx src/scripts/ingest-tier3.ts <venue-id> <json-file>");
    process.exit(1);
  }

  const locations = await loadLocations();
  const location = locations.find((l) => l.id === venueId);
  if (!location) {
    console.error(`Venue not found: ${venueId}`);
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(jsonFile, "utf-8")) as RawParsedEvent[];
  console.log(`Processing ${raw.length} events for ${location.name}...`);

  const result = await processParsedEvents(location.id, location.name, raw);
  console.log(formatProcessingSummary(location.name, result));
}

main().catch(console.error);
