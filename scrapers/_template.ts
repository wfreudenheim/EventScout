/**
 * Tier 2 scraper template. Copy to scrapers/<venue-id>.ts and fill in the
 * selectors for that venue's event page. Generated after a successful Tier 3
 * parse, when the site's HTML is stable and server-rendered.
 *
 * Contract: export a `scrape` function that takes a loaded cheerio document
 * and the page's base URL, and returns RawParsedEvent objects. Scoring,
 * dedup, staging, and logging all happen in the runner — the scraper only
 * extracts. Return an empty array if the page structure no longer matches
 * (the runner treats 0 events as a failure and falls back to Tier 3).
 *
 * Test with:  npx tsx src/scripts/run-scraper.ts <venue-id> --dry-run
 * Enable by setting the venue's registry entry:
 *   "scrape_tier": 2, "generated_scraper": "scrapers/<venue-id>.ts"
 */

import type { CheerioAPI } from "cheerio";
import type { RawParsedEvent } from "../src/agents/tier3-parser.js";

export function scrape($: CheerioAPI, baseUrl: string): RawParsedEvent[] {
  const events: RawParsedEvent[] = [];

  // Example structure — replace selectors with the venue's actual markup:
  //
  // $(".event-card").each((_i, el) => {
  //   const $el = $(el);
  //   const title = $el.find("h3").first().text().trim();
  //   const dateText = $el.find(".date").first().text().trim(); // e.g. "August 14, 2026"
  //   const date = parseUsDate(dateText);
  //   if (!title || !date) return;
  //   const href = $el.find("a").first().attr("href");
  //   events.push({
  //     title,
  //     date,
  //     time_start: undefined, // "19:30" if available
  //     description: $el.find("p").first().text().trim().slice(0, 500) || undefined,
  //     url: href ? new URL(href, baseUrl).href : undefined,
  //     price: undefined, // "free", "$15", etc.
  //   });
  // });

  return events;
}

/** "August 14, 2026" / "Aug 14" -> "2026-08-14" (assumes current year if omitted). */
export function parseUsDate(text: string): string | null {
  const months: Record<string, number> = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
    may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
    september: 9, sep: 9, sept: 9, october: 10, oct: 10,
    november: 11, nov: 11, december: 12, dec: 12,
  };
  const m =
    /(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i.exec(
      text
    );
  if (!m) {
    const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
    return iso ? iso[0] : null;
  }
  const month = months[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  if (!month || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
