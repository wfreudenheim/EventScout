import * as cheerio from "cheerio";
import type { Location, Event } from "../types/index.js";
import { loadInterestProfile, generateEventId } from "../utils/data.js";
import { scoreEvent, inferFormat } from "../utils/scoring.js";

const USER_AGENT =
  "Mozilla/5.0 (compatible; EventScout/0.1; personal event discovery)";

interface ScrapedEvent {
  title: string;
  date?: string;
  time_start?: string;
  time_end?: string;
  description?: string;
  url?: string;
  price?: string;
}

export async function runVenueAgent(location: Location): Promise<Event[]> {
  const profile = await loadInterestProfile();
  const events: Event[] = [];

  for (const source of location.event_sources) {
    if (source.type !== "website") continue;

    try {
      console.log(`  Fetching ${source.url}...`);
      const html = await fetchPage(source.url);
      const scraped = extractEvents(html, source.url);
      console.log(`  Found ${scraped.length} raw events from HTML`);

      for (const raw of scraped) {
        if (!raw.title || !raw.date) continue;

        const { score, matchedCategories, tags } = scoreEvent(
          raw.title,
          raw.description || "",
          profile
        );

        const format = inferFormat(raw.title, raw.description || "");

        const event: Event = {
          id: generateEventId(location.id, raw.date, raw.title),
          title: raw.title,
          venue_id: location.id,
          venue_name: location.name,
          date: raw.date,
          time_start: raw.time_start,
          time_end: raw.time_end,
          description: raw.description?.slice(0, 500),
          url: raw.url,
          price: raw.price,
          format,
          interest_score: score,
          tags,
          matched_categories: matchedCategories,
          source_agent: "venue-agent",
          status: "staged",
          discovered_at: new Date().toISOString(),
        };

        events.push(event);
      }
    } catch (err) {
      console.error(
        `  Error scraping ${source.url}: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  return events;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }

  return await response.text();
}

function extractEvents(html: string, sourceUrl: string): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const baseUrl = new URL(sourceUrl).origin;

  // Strategy: look for common event-like structures in the DOM.
  // This is a heuristic approach — different sites will need different selectors.
  // We try multiple common patterns and merge results.

  // Pattern 1: Elements with event-like class names or attributes
  const eventSelectors = [
    "[class*='event']",
    "[class*='Event']",
    "[class*='calendar-item']",
    "[class*='listing']",
    "[data-event]",
    "article",
    ".program-item",
    ".schedule-item",
  ];

  const seenTitles = new Set<string>();

  for (const selector of eventSelectors) {
    $(selector).each((_i, el) => {
      const $el = $(el);
      const event = extractEventFromElement($, $el, baseUrl);
      if (event && event.title && !seenTitles.has(event.title.toLowerCase())) {
        seenTitles.add(event.title.toLowerCase());
        events.push(event);
      }
    });

    // Stop if we found events with this selector
    if (events.length > 0) break;
  }

  // Pattern 2: If no structured events found, look for date + title combos in lists
  if (events.length === 0) {
    $("li, .item, .row").each((_i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text.length > 10 && text.length < 500) {
        const dateMatch = extractDate(text);
        if (dateMatch) {
          const title = extractTitle($, $el);
          if (title && !seenTitles.has(title.toLowerCase())) {
            seenTitles.add(title.toLowerCase());
            events.push({
              title,
              date: dateMatch,
              url: extractLink($, $el, baseUrl),
              description: text.slice(0, 300),
            });
          }
        }
      }
    });
  }

  return events;
}

function extractEventFromElement(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<any>,
  baseUrl: string
): ScrapedEvent | null {
  const title = extractTitle($, $el);
  if (!title || title.length < 3) return null;

  const text = $el.text();
  const date = extractDate(text);
  const time = extractTime(text);
  const url = extractLink($, $el, baseUrl);
  const price = extractPrice(text);
  const description = extractDescription($, $el);

  return {
    title,
    date: date || undefined,
    time_start: time?.start,
    time_end: time?.end,
    description,
    url,
    price,
  };
}

function extractTitle(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<any>
): string | null {
  // Try heading elements first
  const headingSelectors = ["h1", "h2", "h3", "h4", ".title", ".event-title", "[class*='title']", "a"];
  for (const sel of headingSelectors) {
    const $heading = $el.find(sel).first();
    if ($heading.length) {
      const text = $heading.text().trim();
      if (text.length > 2 && text.length < 200) return text;
    }
  }

  // Fallback: first meaningful text node
  const directText = $el
    .contents()
    .filter(function () {
      return this.type === "text";
    })
    .text()
    .trim();

  if (directText.length > 2 && directText.length < 200) return directText;
  return null;
}

function extractDate(text: string): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Pattern: Month DD, YYYY or Month DD
  const monthNames =
    /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
  const fullDateRegex = new RegExp(
    `(${monthNames.source})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(?:(\\d{4}))?`,
    "i"
  );
  const match = text.match(fullDateRegex);
  if (match) {
    const monthStr = match[1];
    const day = parseInt(match[2], 10);
    const year = match[3] ? parseInt(match[3], 10) : currentYear;
    const month = parseMonth(monthStr);
    if (month !== null && day >= 1 && day <= 31) {
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Pattern: YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // Pattern: MM/DD/YYYY or MM/DD
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    const year = slashMatch[3] ? parseInt(slashMatch[3], 10) : currentYear;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function extractTime(text: string): { start: string; end?: string } | null {
  // Pattern: 7pm, 7:00pm, 7:00 PM, 19:00
  const timeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/g;
  const times = text.match(timeRegex);
  if (times && times.length >= 1) {
    return {
      start: normalizeTime(times[0]),
      end: times.length >= 2 ? normalizeTime(times[1]) : undefined,
    };
  }

  // 24-hour format
  const time24 = text.match(/(\d{2}):(\d{2})(?:\s*[-–]\s*(\d{2}):(\d{2}))?/);
  if (time24) {
    const hour = parseInt(time24[1], 10);
    if (hour >= 0 && hour <= 23) {
      return {
        start: `${time24[1]}:${time24[2]}`,
        end: time24[3] ? `${time24[3]}:${time24[4]}` : undefined,
      };
    }
  }

  return null;
}

function normalizeTime(timeStr: string): string {
  const cleaned = timeStr.replace(/\s/g, "").toLowerCase();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (!match) return timeStr;

  let hour = parseInt(match[1], 10);
  const minutes = match[2] || "00";
  const period = match[3];

  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function extractLink(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<any>,
  baseUrl: string
): string | undefined {
  const $a = $el.find("a").first();
  if (!$a.length) {
    // Check if the element itself is a link
    const href = $el.attr("href");
    if (href) return resolveUrl(href, baseUrl);
    return undefined;
  }
  const href = $a.attr("href");
  if (!href) return undefined;
  return resolveUrl(href, baseUrl);
}

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${baseUrl}${href}`;
  return `${baseUrl}/${href}`;
}

function extractPrice(text: string): string | undefined {
  if (/\bfree\b/i.test(text)) return "free";
  const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (priceMatch) return `$${priceMatch[1]}`;
  return undefined;
}

function extractDescription(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<any>
): string | undefined {
  const descSelectors = [".description", ".summary", ".excerpt", "p"];
  for (const sel of descSelectors) {
    const $desc = $el.find(sel).first();
    if ($desc.length) {
      const text = $desc.text().trim();
      if (text.length > 10) return text.slice(0, 500);
    }
  }
  return undefined;
}

function parseMonth(monthStr: string): number | null {
  const months: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };
  return months[monthStr.toLowerCase()] ?? null;
}
