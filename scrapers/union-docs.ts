/**
 * Tier 2 scraper: UnionDocs. Site embeds schema.org Event JSON-LD
 * (audit 2026-07 found 15 event refs). Generic JSON-LD extraction applies.
 */

import type { CheerioAPI } from "cheerio";
import type { RawParsedEvent } from "../src/agents/tier3-parser.js";
import { scrapeJsonLdEvents } from "../src/utils/jsonld.js";

export function scrape($: CheerioAPI, baseUrl: string): RawParsedEvent[] {
  return scrapeJsonLdEvents($, baseUrl);
}
