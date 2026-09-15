/**
 * Venue audit — systematically tests every venue's event source URL and
 * records signals for scrape-tier tagging:
 *   - HTTP status (accessible? 403? redirected?)
 *   - JS-rendered detection (little text, heavy scripts)
 *   - JSON-LD Event markup (Tier 1/2 candidate)
 *   - Linked RSS feeds and Eventbrite pages (Tier 1 candidates)
 *
 * Writes data/audit.json and prints a summary with a recommended tier per
 * venue. Does not modify the registry — review the report, then update
 * scrape_tier / structured_source / scrape_notes deliberately.
 *
 * Usage:
 *   npx tsx src/scripts/audit-venues.ts [--limit N] [--venue <id>] [--include-pending]
 */

import { writeFile } from "fs/promises";
import * as cheerio from "cheerio";
import type { Location } from "../types/index.js";
import { loadLocations } from "../utils/data.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface AuditResult {
  id: string;
  name: string;
  url: string | null;
  current_tier: number;
  http_status: number | "error" | "no-url";
  error?: string;
  redirected_to?: string;
  html_bytes?: number;
  text_chars?: number;
  js_rendered_suspect?: boolean;
  jsonld_event_count?: number;
  rss_links?: string[];
  eventbrite_links?: string[];
  recommendation: string;
}

async function auditLocation(loc: Location): Promise<AuditResult> {
  const url = loc.event_sources[0]?.url ?? null;
  const base: AuditResult = {
    id: loc.id,
    name: loc.name,
    url,
    current_tier: loc.scrape_tier,
    http_status: "no-url",
    recommendation: "no source URL — find one or mark inactive",
  };
  if (!url) return base;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    base.http_status = response.status;
    if (response.url && response.url.replace(/\/$/, "") !== url.replace(/\/$/, "")) {
      base.redirected_to = response.url;
    }

    if (!response.ok) {
      base.recommendation =
        response.status === 403 || response.status === 429
          ? "blocked — try Eventbrite/RSS fallback or WebFetch (different client)"
          : `HTTP ${response.status} — check URL`;
      return base;
    }

    const html = await response.text();
    base.html_bytes = html.length;

    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    base.text_chars = text.length;
    // Almost no rendered text on a non-trivial page = client-side rendering
    base.js_rendered_suspect = html.length > 5000 && text.length < 400;

    // JSON-LD events (re-parse with scripts intact)
    const $full = cheerio.load(html);
    let jsonldEvents = 0;
    $full('script[type="application/ld+json"]').each((_i, el) => {
      const raw = $full(el).text();
      if (/"@type"\s*:\s*"?\[?[^"]*Event/i.test(raw)) {
        jsonldEvents += (raw.match(/Event/g) ?? []).length;
      }
    });
    base.jsonld_event_count = jsonldEvents;

    // Feed + Eventbrite discovery
    const rss = new Set<string>();
    $full('link[type*="rss"], link[type*="atom"], a[href*="/feed"], a[href$=".rss"], a[href*="rss.xml"]').each(
      (_i, el) => {
        const href = $full(el).attr("href");
        if (href) rss.add(new URL(href, response.url).href);
      }
    );
    base.rss_links = [...rss].slice(0, 3);

    const eb = new Set<string>();
    $full('a[href*="eventbrite.com"]').each((_i, el) => {
      const href = $full(el).attr("href");
      if (href && /eventbrite\.com\/(o|e|cc)\//.test(href)) eb.add(href.split("?")[0]);
    });
    base.eventbrite_links = [...eb].slice(0, 3);

    // Recommendation
    if (jsonldEvents > 0) {
      base.recommendation = `Tier 2 candidate — ${jsonldEvents} JSON-LD event refs, structured markup`;
    } else if (base.eventbrite_links.length > 0) {
      base.recommendation = `Tier 1 candidate — Eventbrite organizer linked: ${base.eventbrite_links[0]}`;
    } else if (base.js_rendered_suspect) {
      base.recommendation = "JS-rendered — Tier 3 via WebFetch only (or find API/feed)";
    } else if (base.rss_links.length > 0) {
      base.recommendation = `Tier 3 (check RSS: ${base.rss_links[0]})`;
    } else {
      base.recommendation = "Tier 3 (server-rendered HTML, no structured markup)";
    }
    return base;
  } catch (err) {
    base.http_status = "error";
    base.error = err instanceof Error ? err.message : String(err);
    base.recommendation = "fetch failed — check URL or network";
    return base;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitFlag = args.indexOf("--limit");
  const limit = limitFlag >= 0 ? parseInt(args[limitFlag + 1], 10) : Infinity;
  const venueFlag = args.indexOf("--venue");
  const venueId = venueFlag >= 0 ? args[venueFlag + 1] : undefined;
  const includePending = args.includes("--include-pending");

  const locations = await loadLocations();
  let targets = locations.filter((l) =>
    venueId
      ? l.id === venueId
      : l.status === "active" || (includePending && l.status === "pending")
  );
  targets = targets.slice(0, limit);

  console.log(`Auditing ${targets.length} venues...\n`);
  const results: AuditResult[] = [];
  for (const loc of targets) {
    const result = await auditLocation(loc);
    results.push(result);
    const statusStr =
      result.http_status === 200
        ? "200"
        : String(result.http_status).padEnd(3);
    console.log(
      `  [${statusStr}] ${result.id.padEnd(28)} ${result.recommendation}`
    );
    // Small delay — we're hitting many different hosts, stay polite
    await new Promise((r) => setTimeout(r, 500));
  }

  await writeFile("data/audit.json", JSON.stringify(results, null, 2), "utf-8");

  const ok = results.filter((r) => r.http_status === 200).length;
  const blocked = results.filter(
    (r) => r.http_status === 403 || r.http_status === 429
  ).length;
  const errored = results.filter(
    (r) => r.http_status === "error" || (typeof r.http_status === "number" && r.http_status >= 400 && r.http_status !== 403 && r.http_status !== 429)
  ).length;
  const jsRendered = results.filter((r) => r.js_rendered_suspect).length;
  const tier1Candidates = results.filter((r) =>
    r.recommendation.startsWith("Tier 1")
  ).length;
  const tier2Candidates = results.filter((r) =>
    r.recommendation.startsWith("Tier 2")
  ).length;

  console.log(`\n=== Audit Summary ===`);
  console.log(`Accessible: ${ok}/${results.length}`);
  console.log(`Blocked (403/429): ${blocked}`);
  console.log(`Errors/other: ${errored}`);
  console.log(`JS-rendered suspects: ${jsRendered}`);
  console.log(`Tier 1 candidates (Eventbrite/RSS): ${tier1Candidates}`);
  console.log(`Tier 2 candidates (structured markup): ${tier2Candidates}`);
  console.log(`\nFull report: data/audit.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
