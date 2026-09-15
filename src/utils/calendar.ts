import type { Event } from "../types/index.js";
import { loadEvents, loadStagedEvents } from "./data.js";

export async function generateWeeklyCalendar(
  options: { weeks?: number; includeStaged?: boolean; minScore?: number } = {}
): Promise<string> {
  const { weeks = 2, includeStaged = true, minScore = 0 } = options;

  let events = await loadEvents();
  if (includeStaged) {
    const staged = await loadStagedEvents();
    events = [...events, ...staged];
  }

  // Filter by score
  events = events.filter((e) => e.interest_score >= minScore);

  // Filter to upcoming events within the window
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + weeks * 7);

  const todayStr = formatDateISO(now);
  const endStr = formatDateISO(endDate);

  events = events.filter((e) => e.date >= todayStr && e.date <= endStr);

  // Sort by date, then by interest score (descending)
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return b.interest_score - a.interest_score;
  });

  // Group by date
  const grouped = new Map<string, Event[]>();
  for (const event of events) {
    const group = grouped.get(event.date) || [];
    group.push(event);
    grouped.set(event.date, group);
  }

  // Generate markdown
  const lines: string[] = [];
  lines.push("# NYC Event Scout — Upcoming Events");
  lines.push("");
  lines.push(`Generated: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
  lines.push(`Window: next ${weeks} week${weeks > 1 ? "s" : ""} | Min score: ${minScore}`);
  lines.push(`Total events: ${events.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (events.length === 0) {
    lines.push("*No events found in this window. Run `scout run` to fetch events.*");
    return lines.join("\n");
  }

  for (const [date, dayEvents] of grouped) {
    const dateObj = new Date(date + "T12:00:00");
    const dayLabel = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    lines.push(`## ${dayLabel}`);
    lines.push("");

    for (const event of dayEvents) {
      const scoreDots = "●".repeat(Math.round(event.interest_score)) +
        "○".repeat(5 - Math.round(event.interest_score));
      const timeStr = event.time_start
        ? ` — ${event.time_start}${event.time_end ? `–${event.time_end}` : ""}`
        : "";
      const venueStr = event.venue_name || event.venue_id;
      const priceStr = event.price ? ` | ${event.price}` : "";
      const formatStr = event.format ? ` \`${event.format}\`` : "";
      const statusBadge = event.status === "staged" ? " 🆕" : "";

      lines.push(`### ${event.title}${statusBadge}`);
      lines.push(
        `${scoreDots} ${venueStr}${timeStr}${priceStr}${formatStr}`
      );

      if (event.matched_categories.length > 0) {
        lines.push(
          event.matched_categories.map((c) => `\`${c}\``).join(" ")
        );
      }

      if (event.description) {
        const desc = event.description.length > 150
          ? event.description.slice(0, 150) + "..."
          : event.description;
        lines.push(`> ${desc}`);
      }

      if (event.url) {
        lines.push(`[View event](${event.url})`);
      }

      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export async function generateLocationList(): Promise<string> {
  const { loadLocations } = await import("./data.js");
  const locations = await loadLocations();
  const events = await loadEvents();
  const staged = await loadStagedEvents();
  const allEvents = [...events, ...staged];

  const lines: string[] = [];
  lines.push("# NYC Event Scout — Venue Directory");
  lines.push("");
  lines.push(`${locations.length} tracked locations`);
  lines.push("");

  // Group by category
  const byNeighborhood = new Map<string, typeof locations>();
  for (const loc of locations) {
    const hood = loc.neighborhood || "Unknown";
    const group = byNeighborhood.get(hood) || [];
    group.push(loc);
    byNeighborhood.set(hood, group);
  }

  // Sort neighborhoods alphabetically
  const hoods = [...byNeighborhood.keys()].sort();

  for (const hood of hoods) {
    const locs = byNeighborhood.get(hood)!;
    lines.push(`## ${hood}`);
    lines.push("");

    for (const loc of locs) {
      const eventCount = allEvents.filter((e) => e.venue_id === loc.id).length;
      const typeTag = loc.entity_type === "org" ? " `org`" : "";
      const catTags = loc.categories.map((c) => `\`${c}\``).join(" ");
      const lastChecked = loc.last_checked
        ? ` | Last checked: ${new Date(loc.last_checked).toLocaleDateString()}`
        : " | Not yet checked";
      const statusBadge = loc.status === "pending" ? " 🆕" : "";

      lines.push(
        `- **${loc.name}**${typeTag}${statusBadge} — ${catTags} | ${eventCount} events${lastChecked} | Score: ${loc.relevance_score}`
      );
    }

    lines.push("");
  }

  return lines.join("\n");
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}
