/**
 * Venue name matching — maps free-text venue names (from aggregator listings,
 * org events, email announcements) to registry locations.
 */

import type { Location } from "../types/index.js";

export interface VenueMatch {
  location: Location;
  confidence: "exact" | "strong" | "weak";
}

function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  const STOP = new Set(["of", "for", "and", "at", "in", "nyc", "new", "york"]);
  return normalizeVenueName(name)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Find the registry location matching a free-text venue name.
 * Tries exact id/name, then containment, then token overlap.
 */
export function matchVenue(
  venueName: string,
  locations: Location[]
): VenueMatch | null {
  const norm = normalizeVenueName(venueName);
  if (!norm) return null;

  const slug = norm.replace(/\s+/g, "-");
  const squashed = norm.replace(/\s+/g, "");
  for (const loc of locations) {
    const locNorm = normalizeVenueName(loc.name);
    if (
      loc.id === slug ||
      locNorm === norm ||
      locNorm.replace(/\s+/g, "") === squashed // "NYCResistor" = "NYC Resistor"
    ) {
      return { location: loc, confidence: "exact" };
    }
  }

  // Containment: "Anthology" -> "Anthology Film Archives", or listing
  // appends detail: "Pioneer Works (Red Hook)" -> "Pioneer Works"
  for (const loc of locations) {
    const locNorm = normalizeVenueName(loc.name);
    const shorter = norm.length <= locNorm.length ? norm : locNorm;
    if (shorter.length >= 5 && (locNorm.includes(norm) || norm.includes(locNorm))) {
      return { location: loc, confidence: "strong" };
    }
  }

  // Token overlap: every significant token of one side appears in the other
  const nameTokens = tokens(venueName);
  if (nameTokens.length === 0) return null;
  for (const loc of locations) {
    const locTokens = tokens(loc.name);
    if (locTokens.length === 0) continue;
    const [small, large] =
      nameTokens.length <= locTokens.length
        ? [nameTokens, locTokens]
        : [locTokens, nameTokens];
    if (small.length >= 1 && small.every((t) => large.includes(t))) {
      const confidence = small.length >= 2 ? "strong" : "weak";
      return { location: loc, confidence };
    }
  }

  return null;
}

/**
 * Build a pending registry entry for a venue discovered via aggregator.
 */
export function buildPendingLocation(venueName: string): Location {
  return {
    id: venueName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    name: venueName,
    entity_type: "venue",
    categories: [],
    event_sources: [],
    scrape_tier: 3,
    structured_source: null,
    generated_scraper: null,
    relevance_score: 2.5,
    added_by: "aggregator",
    status: "pending",
  };
}
