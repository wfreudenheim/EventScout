/**
 * Event archive — past events move out of the active set into
 * data/archive/YYYY-MM.json monthly files (keyed by event date).
 * Events are never deleted, just moved, so we can look back.
 */

import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Event } from "../types/index.js";
import {
  loadEvents,
  saveEvents,
  loadStagedEvents,
  saveStagedEvents,
} from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVE_DIR = path.resolve(__dirname, "../../data/archive");

export interface ArchiveResult {
  archived: number;
  byMonth: Record<string, number>;
  fromApproved: number;
  fromStaged: number;
  remainingApproved: number;
  remainingStaged: number;
}

function isPast(event: Event, todayISO: string): boolean {
  // Only archive events with a well-formed date strictly before today.
  return /^\d{4}-\d{2}-\d{2}$/.test(event.date) && event.date < todayISO;
}

function monthKey(event: Event): string {
  return event.date.slice(0, 7); // YYYY-MM
}

async function loadArchiveMonth(month: string): Promise<Event[]> {
  try {
    const content = await readFile(
      path.join(ARCHIVE_DIR, `${month}.json`),
      "utf-8"
    );
    return JSON.parse(content) as Event[];
  } catch {
    return [];
  }
}

async function saveArchiveMonth(month: string, events: Event[]): Promise<void> {
  if (!existsSync(ARCHIVE_DIR)) {
    await mkdir(ARCHIVE_DIR, { recursive: true });
  }
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
  );
  await writeFile(
    path.join(ARCHIVE_DIR, `${month}.json`),
    JSON.stringify(events, null, 2),
    "utf-8"
  );
}

/**
 * Move all past events (approved and staged) into monthly archive files.
 * With dryRun, reports what would move without touching any files.
 */
export async function archivePastEvents(
  options: { today?: string; dryRun?: boolean } = {}
): Promise<ArchiveResult> {
  const todayISO = options.today ?? new Date().toISOString().split("T")[0];

  const approved = await loadEvents();
  const staged = await loadStagedEvents();

  const pastApproved = approved.filter((e) => isPast(e, todayISO));
  const pastStaged = staged.filter((e) => isPast(e, todayISO));
  const toArchive = [...pastApproved, ...pastStaged];

  const byMonth: Record<string, number> = {};
  for (const event of toArchive) {
    byMonth[monthKey(event)] = (byMonth[monthKey(event)] ?? 0) + 1;
  }

  const result: ArchiveResult = {
    archived: toArchive.length,
    byMonth,
    fromApproved: pastApproved.length,
    fromStaged: pastStaged.length,
    remainingApproved: approved.length - pastApproved.length,
    remainingStaged: staged.length - pastStaged.length,
  };

  if (options.dryRun || toArchive.length === 0) {
    return result;
  }

  // Merge into monthly archive files, deduplicating by event id.
  for (const month of Object.keys(byMonth)) {
    const existing = await loadArchiveMonth(month);
    const existingIds = new Set(existing.map((e) => e.id));
    const incoming = toArchive
      .filter((e) => monthKey(e) === month && !existingIds.has(e.id))
      .map((e) => ({ ...e, status: "archived" as const }));
    await saveArchiveMonth(month, [...existing, ...incoming]);
  }

  await saveEvents(approved.filter((e) => !isPast(e, todayISO)));
  await saveStagedEvents(staged.filter((e) => !isPast(e, todayISO)));

  return result;
}

/**
 * Summary of what's in the archive, for `scout status`.
 */
export async function getArchiveSummary(): Promise<{
  months: { month: string; count: number }[];
  total: number;
}> {
  if (!existsSync(ARCHIVE_DIR)) {
    return { months: [], total: 0 };
  }
  const files = (await readdir(ARCHIVE_DIR)).filter((f) =>
    /^\d{4}-\d{2}\.json$/.test(f)
  );
  const months: { month: string; count: number }[] = [];
  for (const file of files.sort()) {
    const events = await loadArchiveMonth(file.replace(".json", ""));
    months.push({ month: file.replace(".json", ""), count: events.length });
  }
  return { months, total: months.reduce((sum, m) => sum + m.count, 0) };
}

export function formatArchiveResult(
  result: ArchiveResult,
  dryRun: boolean
): string {
  const verb = dryRun ? "Would archive" : "Archived";
  const lines = [
    `\n=== Event Archive ${dryRun ? "(dry run)" : ""} ===`,
    `${verb}: ${result.archived} past events (${result.fromApproved} approved, ${result.fromStaged} staged)`,
  ];
  const months = Object.keys(result.byMonth).sort();
  for (const month of months) {
    lines.push(`  ${month}: ${result.byMonth[month]} events -> data/archive/${month}.json`);
  }
  lines.push(
    `Active set now: ${result.remainingApproved} approved, ${result.remainingStaged} staged`
  );
  return lines.join("\n");
}
