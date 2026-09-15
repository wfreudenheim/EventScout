/**
 * Ingest events from a JSON string passed as a CLI argument.
 * Usage: npx tsx src/scripts/ingest-json.ts <venue-id> '<json-array>'
 */

import {
  processParsedEvents,
  formatProcessingSummary,
  type RawParsedEvent,
} from "../agents/tier3-parser.js";
import { loadLocations } from "../utils/data.js";

async function main() {
  const venueId = process.argv[2];
  const jsonStr = process.argv[3];

  if (!venueId || !jsonStr) {
    console.error("Usage: npx tsx src/scripts/ingest-json.ts <venue-id> '<json>'");
    process.exit(1);
  }

  const locations = await loadLocations();
  const location = locations.find(
    (l) =>
      l.id === venueId ||
      l.name.toLowerCase() === venueId.toLowerCase() ||
      l.name.toLowerCase().includes(venueId.toLowerCase())
  );
  if (!location) {
    console.error(`Venue not found: ${venueId}`);
    process.exit(1);
  }

  const raw = JSON.parse(jsonStr) as RawParsedEvent[];
  console.log(`Processing ${raw.length} events for ${location.name}...`);

  const result = await processParsedEvents(location.id, location.name, raw);
  console.log(formatProcessingSummary(location.name, result));
}

main().catch(console.error);
