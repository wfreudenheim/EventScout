/**
 * Prepare a full scout run. Reads the registry, lists all active venues
 * with their source URLs, and outputs the batch plan.
 *
 * Usage: npx tsx src/scripts/prepare-run.ts [--category <cat>] [--venue <name>]
 */

import { loadLocations, loadAgentLog } from "../utils/data.js";
import type { Location } from "../types/index.js";

async function main() {
  const args = process.argv.slice(2);
  const categoryFilter = getFlag(args, "--category");
  const venueFilter = getFlag(args, "--venue");

  const locations = await loadLocations();
  let targets = locations.filter((l) => l.status === "active");

  if (categoryFilter) {
    targets = targets.filter((l) =>
      l.categories.some((c) => c.includes(categoryFilter.toLowerCase()))
    );
  }

  if (venueFilter) {
    targets = targets.filter(
      (l) =>
        l.name.toLowerCase().includes(venueFilter.toLowerCase()) ||
        l.id.includes(venueFilter.toLowerCase())
    );
  }

  // Sort by relevance score (highest first) so the most interesting venues get processed first
  targets.sort((a, b) => b.relevance_score - a.relevance_score);

  // Get recent agent log to identify last-checked times
  const log = await loadAgentLog();

  console.log(`\n=== Scout Run Plan ===`);
  console.log(`Venues to check: ${targets.length}`);
  console.log(`\n${"ID".padEnd(30)} ${"Name".padEnd(35)} ${"Score".padEnd(6)} ${"Tier".padEnd(5)} Source URL`);
  console.log("-".repeat(130));

  const batches: Location[][] = [];
  let currentBatch: Location[] = [];

  for (const loc of targets) {
    const url = loc.event_sources[0]?.url || "NO URL";
    const lastRun = log.filter((r) => r.target_id === loc.id).pop();
    const status = lastRun
      ? lastRun.status === "completed"
        ? `✓ ${lastRun.events_found}ev`
        : `✗ ${lastRun.error?.slice(0, 30)}`
      : "never";

    console.log(
      `${loc.id.padEnd(30)} ${loc.name.padEnd(35)} ${String(loc.relevance_score).padEnd(6)} T${loc.scrape_tier}    ${url}`
    );

    currentBatch.push(loc);
    if (currentBatch.length >= 5) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  console.log(`\n=== Batch Plan (${batches.length} batches of ~5) ===\n`);
  for (let i = 0; i < batches.length; i++) {
    console.log(
      `Batch ${i + 1}: ${batches[i].map((l) => l.id).join(", ")}`
    );
  }

  // Output a compact JSON list for use by the runner
  const runPlan = targets.map((l) => ({
    id: l.id,
    name: l.name,
    url: l.event_sources[0]?.url,
    tier: l.scrape_tier,
  }));

  // Write run plan to temp file for reference
  const { writeFile } = await import("fs/promises");
  await writeFile(
    "data/tmp/run-plan.json",
    JSON.stringify(runPlan, null, 2)
  );
  console.log(`\nRun plan written to data/tmp/run-plan.json`);
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

main().catch(console.error);
