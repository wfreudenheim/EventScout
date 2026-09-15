import { prepareTier3Context, processParsedEvents, formatProcessingSummary } from "../agents/tier3-parser.js";

async function main() {
  const venueName = process.argv[2] || "Pioneer Works";
  console.log(`Loading context for: ${venueName}`);

  const ctx = await prepareTier3Context(venueName);
  console.log(`Venue: ${ctx.location.name}`);
  console.log(`ID: ${ctx.location.id}`);
  console.log(`Sources: ${ctx.location.event_sources.map((s) => s.url).join(", ")}`);
  console.log(`Existing events in system: ${ctx.existingEventCount}`);
}

main().catch(console.error);
