/**
 * Shared JSON-LD event extraction. Any site embedding schema.org Event
 * markup (<script type="application/ld+json">) can be scraped generically —
 * used by Tier 2 scrapers and the Eventbrite fetcher.
 */

import type { CheerioAPI } from "cheerio";
import type { RawParsedEvent } from "../agents/tier3-parser.js";

export interface JsonLdEvent {
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
export function collectEvents(node: any, out: JsonLdEvent[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectEvents(item, out);
    return;
  }
  if (isEventType(node)) {
    out.push(node);
  }
  for (const key of ["@graph", "itemListElement", "item", "mainEntity"]) {
    if (node[key]) collectEvents(node[key], out);
  }
}

/** Strip HTML tags and decode entities that show up inside JSON-LD strings. */
function cleanText(text: string): string {
  const NAMED: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
    lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  };
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePrice(offers: JsonLdEvent["offers"]): string | undefined {
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const price = offer?.lowPrice ?? offer?.price;
  if (price == null) return undefined;
  const num = Number(price);
  if (Number.isNaN(num)) return String(price);
  return num === 0 ? "free" : `$${num}`;
}

export function toRawEvent(ld: JsonLdEvent): RawParsedEvent | null {
  if (!ld.name || !ld.startDate) return null;
  const start = ld.startDate;
  const date = start.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    title: cleanText(ld.name),
    date,
    time_start: /T(\d{2}:\d{2})/.exec(start)?.[1],
    time_end: ld.endDate ? /T(\d{2}:\d{2})/.exec(ld.endDate)?.[1] : undefined,
    description: ld.description ? cleanText(ld.description).slice(0, 500) : undefined,
    url: ld.url,
    price: parsePrice(ld.offers),
    venue_name: ld.location?.name,
  };
}

/**
 * Extract all schema.org events from a loaded page, deduplicated by
 * title+date. Suitable as a complete Tier 2 scraper for JSON-LD sites.
 */
export function scrapeJsonLdEvents($: CheerioAPI, baseUrl: string): RawParsedEvent[] {
  const ldEvents: JsonLdEvent[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      collectEvents(JSON.parse($(el).text()), ldEvents);
    } catch {
      // malformed JSON-LD block — skip
    }
  });

  const events = ldEvents
    .map(toRawEvent)
    .filter((e): e is RawParsedEvent => e !== null)
    .map((e) => ({
      ...e,
      url: e.url ? new URL(e.url, baseUrl).href : undefined,
    }));

  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.title.toLowerCase()}|${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
