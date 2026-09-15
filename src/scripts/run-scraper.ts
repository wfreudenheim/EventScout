/**
 * Tier 2 runner: executes a generated scraper for a venue and ingests the
 * results through the standard scoring/dedup/staging pipeline.
 *
 * On any failure (fetch error, scraper throws, 0 events extracted) it logs a
 * failed run and exits with code 2 — the signal to fall back to Tier 3 and
 * regenerate the scraper if the site was redesigned.
 *
 * Usage:
 *   npx tsx src/scripts/run-scraper.ts <venue-id> [--dry-run]
 *   npx tsx src/scripts/run-scraper.ts --all [--dry-run]   # every tier-2 venue
 */

import { existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import * as cheerio from "cheerio";
import type { Location, AgentRun } from "../types/index.js";
import { loadLocations, appendAgentLog } from "../utils/data.js";
import {
  processParsedEvents,
  formatProcessingSummary,
  type RawParsedEvent,
} from "../agents/tier3-parser.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function logFailure(venueId: string, error: string): Promise<void> {
  const run: AgentRun = {
    agent_type: "venue-agent",
    target_id: venueId,
    scrape_tier_used: 2,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    events_found: 0,
    events_new: 0,
    status: "failed",
    error,
  };
  await appendAgentLog(run);
}

function validateEvents(events: unknown): RawParsedEvent[] {
  if (!Array.isArray(events)) return [];
  const todayISO = new Date().toISOString().split("T")[0];
  return events.filter(
    (e): e is RawParsedEvent =>
      !!e &&
      typeof e.title === "string" &&
      e.title.length > 0 &&
      typeof e.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
      e.date >= todayISO
  );
}

async function runOne(loc: Location, dryRun: boolean): Promise<boolean> {
  const scraperRel = loc.generated_scraper ?? `scrapers/${loc.id}.ts`;
  const scraperPath = path.resolve(scraperRel);
  console.log(`\n=== ${loc.name} (Tier 2: ${scraperRel}) ===`);

  if (!existsSync(scraperPath)) {
    console.error(`  Scraper not found: ${scraperRel} — fall back to Tier 3.`);
    await logFailure(loc.id, `scraper not found: ${scraperRel}`);
    return false;
  }

  const sourceUrl = loc.event_sources.find((s) => s.type === "website")?.url;
  if (!sourceUrl) {
    console.error(`  No website source URL in registry.`);
    await logFailure(loc.id, "no website source URL");
    return false;
  }

  try {
    console.log(`  Fetching ${sourceUrl} ...`);
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    const mod = await import(pathToFileURL(scraperPath).href);
    if (typeof mod.scrape !== "function") {
      throw new Error(`scraper does not export a scrape() function`);
    }

    const baseUrl = new URL(sourceUrl).origin;
    const events = validateEvents(mod.scrape(cheerio.load(html), baseUrl));
    console.log(`  Extracted ${events.length} valid events.`);

    if (events.length === 0) {
      console.error(
        `  0 events — site may have been redesigned. Fall back to Tier 3 and regenerate the scraper.`
      );
      await logFailure(loc.id, "scraper returned 0 events (site redesigned?)");
      return false;
    }

    if (dryRun) {
      for (const e of events.slice(0, 15)) {
        console.log(`    [${e.date}] ${e.title}${e.price ? ` (${e.price})` : ""}`);
      }
      if (events.length > 15) console.log(`    ... and ${events.length - 15} more`);
      return true;
    }

    const result = await processParsedEvents(loc.id, loc.name, events, {
      sourceAgent: "tier2-scraper",
      scrapeTier: 2,
    });
    console.log(formatProcessingSummary(loc.name, result));
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Failed: ${msg} — fall back to Tier 3.`);
    await logFailure(loc.id, msg);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const venueId = args.find((a) => !a.startsWith("--"));

  const locations = await loadLocations();
  let targets: Location[];

  if (all) {
    targets = locations.filter(
      (l) => l.status === "active" && l.scrape_tier === 2
    );
    if (targets.length === 0) {
      console.log("No active Tier 2 venues in the registry yet.");
      return;
    }
  } else if (venueId) {
    const loc = locations.find((l) => l.id === venueId);
    if (!loc) {
      console.error(`Venue not found: ${venueId}`);
      process.exit(1);
    }
    targets = [loc];
  } else {
    console.error(
      "Usage: npx tsx src/scripts/run-scraper.ts <venue-id> [--dry-run]  |  --all [--dry-run]"
    );
    process.exit(1);
    return;
  }

  let failures = 0;
  for (const loc of targets) {
    const ok = await runOne(loc, dryRun);
    if (!ok) failures++;
  }

  if (all) {
    console.log(
      `\n=== Tier 2 sweep: ${targets.length - failures}/${targets.length} succeeded ===`
    );
    if (failures > 0) {
      console.log(`${failures} venue(s) need Tier 3 fallback (see errors above).`);
    }
  }
  if (failures > 0) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
