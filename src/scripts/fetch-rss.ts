/**
 * Tier 1 fetcher: RSS/Atom feeds. Parses feed items into RawParsedEvent JSON.
 *
 * Event dates: feeds rarely mark the *event* date in a structured way, so we
 * look for a date in the item title/description first; pubDate is only used
 * as a fallback when it's in the future (announcements usually predate the
 * event, so past pubDates mean we couldn't find the real date — those items
 * are reported as skipped).
 *
 * Usage:
 *   npx tsx src/scripts/fetch-rss.ts <venue-id | feed-url> [--out <file>]
 */

import { writeFile, mkdir } from "fs/promises";
import * as cheerio from "cheerio";
import type { RawParsedEvent } from "../agents/tier3-parser.js";
import { loadLocations } from "../utils/data.js";

const USER_AGENT =
  "Mozilla/5.0 (compatible; EventScout/0.1; personal event discovery)";

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

/** Find an event-looking date in free text. Returns YYYY-MM-DD or null. */
function extractDateFromText(text: string, todayISO: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return iso[0];

  const currentYear = parseInt(todayISO.slice(0, 4), 10);
  const monthName =
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i.exec(
      text
    );
  if (monthName) {
    const month = MONTHS[monthName[1].toLowerCase()];
    const day = parseInt(monthName[2], 10);
    let year = monthName[3] ? parseInt(monthName[3], 10) : currentYear;
    if (month && day >= 1 && day <= 31) {
      let date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // No year given and date already passed -> probably next year
      if (!monthName[3] && date < todayISO) {
        year += 1;
        date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
      return date;
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

export async function fetchRssEvents(
  feedUrl: string
): Promise<{ events: RawParsedEvent[]; skipped: { title: string; reason: string }[] }> {
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${feedUrl}`);
  }
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const todayISO = new Date().toISOString().split("T")[0];
  const events: RawParsedEvent[] = [];
  const skipped: { title: string; reason: string }[] = [];

  // RSS 2.0 <item> and Atom <entry>
  $("item, entry").each((_i, el) => {
    const $el = $(el);
    const title = $el.find("title").first().text().trim();
    if (!title) return;

    const descriptionRaw =
      $el.find("description").first().text() ||
      $el.find("summary").first().text() ||
      $el.find("content").first().text();
    const description = stripHtml(descriptionRaw).slice(0, 500);

    const link =
      $el.find("link").first().attr("href") ?? // Atom
      $el.find("link").first().text().trim(); // RSS

    const pubDateStr =
      $el.find("pubDate").first().text() ||
      $el.find("published").first().text() ||
      $el.find("updated").first().text();

    let date = extractDateFromText(`${title} ${description}`, todayISO);
    if (!date && pubDateStr) {
      const pub = new Date(pubDateStr);
      if (!Number.isNaN(pub.getTime())) {
        const pubISO = pub.toISOString().split("T")[0];
        if (pubISO >= todayISO) date = pubISO;
      }
    }

    if (!date) {
      skipped.push({ title, reason: "no event date found" });
      return;
    }
    if (date < todayISO) {
      skipped.push({ title, reason: `past date ${date}` });
      return;
    }

    events.push({ title, date, description, url: link || undefined });
  });

  return { events, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const outFlag = args.indexOf("--out");
  const outOverride = outFlag >= 0 ? args[outFlag + 1] : undefined;
  const arg = args.filter(
    (a, i) => !a.startsWith("--") && (outFlag < 0 || i !== outFlag + 1)
  )[0];

  if (!arg) {
    console.error("Usage: npx tsx src/scripts/fetch-rss.ts <venue-id | feed-url> [--out <file>]");
    process.exit(1);
  }

  let url = arg;
  let outName = "rss-fetch";
  let venueId: string | undefined;

  if (!arg.startsWith("http")) {
    const locations = await loadLocations();
    const loc = locations.find((l) => l.id === arg);
    if (!loc) {
      console.error(`Venue not found: ${arg}`);
      process.exit(1);
    }
    const rssSource =
      loc.event_sources.find((s) => s.type === "rss" || s.type === "substack")?.url;
    if (!rssSource) {
      console.error(`${loc.name} has no rss/substack source in the registry.`);
      process.exit(1);
    }
    // Substack: append /feed for the RSS endpoint
    url = rssSource.includes("substack.com") && !rssSource.includes("/feed")
      ? rssSource.replace(/\/?$/, "/feed")
      : rssSource;
    outName = `${loc.id}-rss`;
    venueId = loc.id;
  }

  console.log(`Fetching ${url} ...`);
  const { events, skipped } = await fetchRssEvents(url);
  console.log(`Extracted ${events.length} dated items, skipped ${skipped.length}.`);
  for (const s of skipped.slice(0, 10)) {
    console.log(`  skipped: ${s.title.slice(0, 60)} (${s.reason})`);
  }

  await mkdir("data/tmp", { recursive: true });
  const outPath = outOverride ?? `data/tmp/${outName}.json`;
  await writeFile(outPath, JSON.stringify(events, null, 2), "utf-8");
  console.log(`Written to ${outPath}`);

  if (events.length > 0 && venueId) {
    console.log(`\nIngest with:\n  npx tsx src/scripts/ingest-tier3.ts ${venueId} ${outPath}`);
  }
}

if (process.argv[1]?.includes("fetch-rss")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
