/**
 * Tier 1 fetcher: Eventbrite. No API key needed — Eventbrite server-renders
 * event data as JSON-LD (schema.org Event) on organizer pages (/o/...) and
 * search pages (/d/...). This extracts it into RawParsedEvent JSON.
 *
 * Usage:
 *   npx tsx src/scripts/fetch-eventbrite.ts <venue-id>           # uses the venue's eventbrite source
 *   npx tsx src/scripts/fetch-eventbrite.ts <eventbrite-url>     # fetch a URL directly
 *
 * Writes data/tmp/<venue-id>-eb.json (or eventbrite-fetch.json for raw URLs)
 * and prints the ingest command. Scoring happens at ingest (keyword engine).
 */

import { writeFile, mkdir } from "fs/promises";
import * as cheerio from "cheerio";
import type { RawParsedEvent } from "../agents/tier3-parser.js";
import { loadLocations } from "../utils/data.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface JsonLdEvent {
  "@type"?: string | string[];
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  url?: string;
  offers?: { price?: string | number; lowPrice?: string | number } | any[];
  location?: { name?: string };
}

function isEventType(node: any): boolean {
  const t = node?.["@type"];
  if (!t) return false;
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && x.includes("Event"));
}

/** Walk any JSON-LD structure (@graph, ItemList, arrays) collecting Event nodes. */
function collectEvents(node: any, out: JsonLdEvent[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectEvents(item, out);
    return;
  }
  if (isEventType(node)) {
    out.push(node);
  }
  for (const key of ["@graph", "itemListElement", "item"]) {
    if (node[key]) collectEvents(node[key], out);
  }
}

function parsePrice(offers: JsonLdEvent["offers"]): string | undefined {
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const price = offer?.lowPrice ?? offer?.price;
  if (price == null) return undefined;
  const num = Number(price);
  if (Number.isNaN(num)) return String(price);
  return num === 0 ? "free" : `$${num}`;
}

function toRawEvent(ld: JsonLdEvent): RawParsedEvent | null {
  if (!ld.name || !ld.startDate) return null;
  const start = ld.startDate; // ISO 8601, e.g. 2026-08-14T19:00:00-04:00
  const date = start.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    title: ld.name.trim(),
    date,
    time_start: /T(\d{2}:\d{2})/.exec(start)?.[1],
    time_end: ld.endDate ? /T(\d{2}:\d{2})/.exec(ld.endDate)?.[1] : undefined,
    description: ld.description?.trim().slice(0, 500),
    url: ld.url,
    price: parsePrice(ld.offers),
    venue_name: ld.location?.name,
  };
}

export async function fetchEventbriteEvents(url: string): Promise<RawParsedEvent[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  const ldEvents: JsonLdEvent[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      collectEvents(JSON.parse($(el).text()), ldEvents);
    } catch {
      // malformed JSON-LD block — skip
    }
  });

  // Fallback: Eventbrite search pages embed results in window.__SERVER_DATA__
  if (ldEvents.length === 0) {
    const serverData = /window\.__SERVER_DATA__\s*=\s*(\{.*?\});\s*\n/s.exec(html);
    if (serverData) {
      try {
        const data = JSON.parse(serverData[1]);
        const results =
          data?.search_data?.events?.results ?? data?.events?.results ?? [];
        for (const r of results) {
          if (r?.name && (r?.start_date || r?.start?.local)) {
            const startDate = r.start_date ?? r.start.local.slice(0, 10);
            ldEvents.push({
              "@type": "Event",
              name: r.name,
              startDate: `${startDate}T${r.start_time ?? ""}`,
              url: r.url,
              description: r.summary,
              location: { name: r.primary_venue?.name },
              offers: r.ticket_availability?.minimum_ticket_price
                ? { price: r.ticket_availability.minimum_ticket_price.major_value }
                : undefined,
            });
          }
        }
      } catch {
        // server data blob unparseable — fall through to empty result
      }
    }
  }

  const events = ldEvents
    .map(toRawEvent)
    .filter((e): e is RawParsedEvent => e !== null);

  // Dedupe by title+date (JSON-LD often repeats events across blocks)
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.title.toLowerCase()}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: npx tsx src/scripts/fetch-eventbrite.ts <venue-id | eventbrite-url>"
    );
    process.exit(1);
  }

  let url = arg;
  let outName = "eventbrite-fetch";
  let venueId: string | undefined;

  if (!arg.startsWith("http")) {
    const locations = await loadLocations();
    const loc = locations.find((l) => l.id === arg);
    if (!loc) {
      console.error(`Venue not found: ${arg}`);
      process.exit(1);
    }
    const ebSource =
      loc.event_sources.find((s) => s.type === "eventbrite")?.url ??
      (loc.structured_source?.includes("eventbrite")
        ? loc.structured_source
        : undefined);
    if (!ebSource) {
      console.error(`${loc.name} has no eventbrite source in the registry.`);
      process.exit(1);
    }
    url = ebSource;
    outName = `${loc.id}-eb`;
    venueId = loc.id;
  }

  console.log(`Fetching ${url} ...`);
  const events = await fetchEventbriteEvents(url);
  console.log(`Extracted ${events.length} events.`);

  await mkdir("data/tmp", { recursive: true });
  const outPath = `data/tmp/${outName}.json`;
  await writeFile(outPath, JSON.stringify(events, null, 2), "utf-8");
  console.log(`Written to ${outPath}`);

  if (events.length > 0) {
    console.log(`\nIngest with:`);
    if (venueId) {
      console.log(`  npx tsx src/scripts/ingest-tier3.ts ${venueId} ${outPath}`);
    } else {
      console.log(
        `  npx tsx src/scripts/ingest-aggregator.ts eventbrite ${outPath}   # events carry venue_name`
      );
    }
  }
}

// Only run main when executed directly (this module is also imported)
if (process.argv[1]?.includes("fetch-eventbrite")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
