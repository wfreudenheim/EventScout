import { Command } from "commander";
import { dispatchAll, dispatchForVenue } from "../agents/dispatcher.js";
import {
  loadLocations,
  loadEvents,
  loadStagedEvents,
  saveStagedEvents,
  saveEvents,
  loadAgentLog,
} from "../utils/data.js";
import { generateWeeklyCalendar, generateLocationList } from "../utils/calendar.js";
import {
  archivePastEvents,
  formatArchiveResult,
  getArchiveSummary,
} from "../utils/archive.js";
import { prepareTier3Context } from "../agents/tier3-parser.js";
import { buildVenuePrompt } from "../utils/prompts.js";
import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../../output");

const program = new Command();

program
  .name("scout")
  .description("NYC Event Scout — cultural event discovery system")
  .version("0.1.0");

// === scout run ===
program
  .command("run")
  .description("Run agents to scrape events from all active venues")
  .option("--venue <name>", "Only scrape a specific venue")
  .action(async (opts) => {
    try {
      const result = opts.venue
        ? await dispatchForVenue(opts.venue)
        : await dispatchAll();

      console.log("\n=== Scout Run Complete ===");
      console.log(`Venues checked: ${result.totalVenues}`);
      console.log(`Events found: ${result.totalEventsFound}`);
      console.log(`New events staged: ${result.totalNewEvents}`);
      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.length}`);
        for (const err of result.errors) {
          console.log(`  - ${err}`);
        }
      }
      console.log("\nRun 'scout review' to approve staged events.");
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : err}`
      );
      process.exit(1);
    }
  });

// === scout calendar ===
program
  .command("calendar")
  .description("Generate a weekly calendar of upcoming events")
  .option("--weeks <n>", "Number of weeks to show", "2")
  .option("--min-score <n>", "Minimum interest score", "0")
  .option("--staged", "Include staged (unapproved) events", true)
  .option("--output <path>", "Write to file instead of stdout")
  .action(async (opts) => {
    const markdown = await generateWeeklyCalendar({
      weeks: parseInt(opts.weeks, 10),
      minScore: parseFloat(opts.minScore),
      includeStaged: opts.staged,
    });

    if (opts.output) {
      await writeFile(opts.output, markdown, "utf-8");
      console.log(`Calendar written to ${opts.output}`);
    } else {
      console.log(markdown);
    }
  });

// === scout locations ===
program
  .command("locations")
  .description("Browse the venue/location registry")
  .option("--output <path>", "Write to file instead of stdout")
  .action(async (opts) => {
    const markdown = await generateLocationList();

    if (opts.output) {
      await writeFile(opts.output, markdown, "utf-8");
      console.log(`Location list written to ${opts.output}`);
    } else {
      console.log(markdown);
    }
  });

// === scout review ===
program
  .command("review")
  .description("Review and approve staged events")
  .option("--auto-approve <score>", "Auto-approve events above this score")
  .option("--approve-all", "Approve all staged events")
  .action(async (opts) => {
    const staged = await loadStagedEvents();

    if (staged.length === 0) {
      console.log("No staged events to review.");
      return;
    }

    console.log(`\n${staged.length} staged events:\n`);

    let approved = 0;
    let remaining: typeof staged = [];

    if (opts.approveAll) {
      // Approve everything
      for (const event of staged) {
        event.status = "approved";
      }
      approved = staged.length;
    } else if (opts.autoApprove) {
      const threshold = parseFloat(opts.autoApprove);
      for (const event of staged) {
        if (event.interest_score >= threshold) {
          event.status = "approved";
          approved++;
        } else {
          remaining.push(event);
        }
      }
    } else {
      // Print staged events for manual review
      for (const event of staged) {
        const score = "●".repeat(Math.round(event.interest_score)) +
          "○".repeat(5 - Math.round(event.interest_score));
        console.log(
          `  ${score} [${event.date}] ${event.title} @ ${event.venue_name || event.venue_id}`
        );
        if (event.matched_categories.length > 0) {
          console.log(`        ${event.matched_categories.join(", ")}`);
        }
      }
      console.log(
        "\nUse --approve-all or --auto-approve <score> to approve events."
      );
      return;
    }

    // Move approved events to events.json
    const approvedEvents = staged.filter((e) => e.status === "approved");
    if (approvedEvents.length > 0) {
      const existing = await loadEvents();
      existing.push(...approvedEvents);
      await saveEvents(existing);
    }

    // Keep remaining in staging
    await saveStagedEvents(remaining);

    console.log(`Approved: ${approved}`);
    console.log(`Remaining in staging: ${remaining.length}`);
  });

// === scout archive ===
program
  .command("archive")
  .description("Move past events out of the active set into data/archive/YYYY-MM.json")
  .option("--dry-run", "Show what would be archived without moving anything")
  .action(async (opts) => {
    const result = await archivePastEvents({ dryRun: opts.dryRun });
    if (result.archived === 0) {
      console.log("No past events to archive.");
      return;
    }
    console.log(formatArchiveResult(result, !!opts.dryRun));
  });

// === scout context ===
program
  .command("context <venue>")
  .description("Print venue info and the Tier 3 extraction prompt for a Claude-powered parse")
  .action(async (venue) => {
    const ctx = await prepareTier3Context(venue);
    console.log(`\n=== Tier 3 Context: ${ctx.location.name} ===`);
    console.log(`Venue ID: ${ctx.location.id}`);
    console.log(`Tier: ${ctx.location.scrape_tier}`);
    if (ctx.location.scrape_notes) {
      console.log(`Scrape notes: ${ctx.location.scrape_notes}`);
    }
    console.log(`Source URLs:`);
    for (const src of ctx.location.event_sources) {
      console.log(`  [${src.type}] ${src.url}${src.notes ? ` — ${src.notes}` : ""}`);
    }
    console.log(`Existing events in system: ${ctx.existingEventCount}`);
    console.log(`\n--- Extraction prompt (use with WebFetch on a source URL) ---\n`);
    console.log(buildVenuePrompt(ctx.location.name));
    console.log(`\n--- After parsing, ingest with ---`);
    console.log(`npx tsx src/scripts/ingest-tier3.ts ${ctx.location.id} data/tmp/${ctx.location.id}.json`);
  });

// === scout status ===
program
  .command("status")
  .description("Show system status and recent agent activity")
  .action(async () => {
    const locations = await loadLocations();
    const events = await loadEvents();
    const staged = await loadStagedEvents();
    const log = await loadAgentLog();

    const active = locations.filter((l) => l.status === "active").length;
    const checked = locations.filter((l) => l.last_checked).length;

    const todayISO = new Date().toISOString().split("T")[0];
    const stale = [...events, ...staged].filter((e) => e.date < todayISO).length;
    const archive = await getArchiveSummary();

    console.log("\n=== NYC Event Scout Status ===\n");
    console.log(`Locations: ${locations.length} total, ${active} active, ${checked} checked`);
    console.log(`Events: ${events.length} approved, ${staged.length} staged`);
    if (archive.total > 0) {
      const range = `${archive.months[0].month} to ${archive.months[archive.months.length - 1].month}`;
      console.log(`Archive: ${archive.total} past events across ${archive.months.length} months (${range})`);
    }
    if (stale > 0) {
      console.log(`⚠ ${stale} past-dated events in the active set — run 'scout archive' to clean up`);
    }
    console.log(`Agent runs: ${log.length} total`);

    // Recent runs
    const recent = log.slice(-5).reverse();
    if (recent.length > 0) {
      console.log("\nRecent agent runs:");
      for (const run of recent) {
        const status = run.status === "completed" ? "✓" : "✗";
        console.log(
          `  ${status} ${run.target_id} — ${run.events_found} found, ${run.events_new} new (${run.started_at})`
        );
      }
    }
  });

// === scout add-venue ===
program
  .command("add-venue")
  .description("Manually add a venue to the registry")
  .requiredOption("--name <name>", "Venue name")
  .requiredOption("--url <url>", "Event source URL")
  .option("--type <type>", "Entity type: venue or org", "venue")
  .option("--neighborhood <hood>", "Neighborhood")
  .option("--address <address>", "Street address")
  .option("--categories <cats>", "Comma-separated categories")
  .action(async (opts) => {
    const locations = await loadLocations();
    const id = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    if (locations.find((l) => l.id === id)) {
      console.error(`Venue "${opts.name}" already exists with id "${id}".`);
      process.exit(1);
    }

    const newLocation = {
      id,
      name: opts.name,
      entity_type: opts.type as "venue" | "org",
      address: opts.address,
      neighborhood: opts.neighborhood,
      categories: opts.categories
        ? opts.categories.split(",").map((c: string) => c.trim())
        : [],
      event_sources: [{ type: "website" as const, url: opts.url }],
      scrape_tier: 3 as const,
      structured_source: null,
      generated_scraper: null,
      relevance_score: 3.0,
      added_by: "manual" as const,
      status: "active" as const,
    };

    locations.push(newLocation);
    const { saveLocations } = await import("../utils/data.js");
    await saveLocations(locations);
    console.log(`Added "${opts.name}" (${id}) to the location registry.`);
  });

program.parse();
