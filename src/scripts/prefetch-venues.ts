/**
 * Fetch every active Tier 3 venue's event page and save it as stripped text so
 * the cloud sweep routine (whose network is restricted) can parse events from
 * local files instead of WebFetch. Runs in the Prefetch GitHub Action, which
 * has unrestricted outbound network.
 *
 * Output:
 *   data/prefetch/venues/<venue-id>.txt   — header line + page text (links kept
 *                                            as "text [href]" so event URLs survive)
 *   data/prefetch/venues/_report.json     — per-venue status: ok / http error /
 *                                            empty / network error, with sizes
 *
 * Usage:
 *   npx tsx src/scripts/prefetch-venues.ts                 # all active Tier 3 venues
 *   npx tsx src/scripts/prefetch-venues.ts --venue <id>    # one venue
 *   npx tsx src/scripts/prefetch-venues.ts --max-kb 40     # per-file cap (default 40)
 */

import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { convert } from "html-to-text";
import { loadLocations } from "../utils/data.js";

const OUT_DIR = "data/prefetch/venues";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const CONCURRENCY = 6;
const TIMEOUT_MS = 25_000;

interface Report {
  id: string;
  name: string;
  url: string;
  status: "ok" | "empty" | "http" | "error";
  http?: number;
  chars?: number;
  note?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function toText(html: string): string {
  let txt = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "noscript", format: "skip" },
      { selector: "svg", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "footer", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true, ignoreHref: false } },
    ],
  });
  txt = txt
    .replace(/[͏‌­​ ﻿‍⁠]/g, "")
    .replace(/\[(https?:\/\/[^\]]*?)\?[^\]]*\]/g, "[$1]") // drop query strings on links
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
  return txt.trim();
}

async function fetchOne(id: string, name: string, url: string, maxChars: number): Promise<Report> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { id, name, url, status: "http", http: res.status, note: res.statusText };
    }
    const html = await res.text();
    let text = toText(html);
    if (text.length < 400) {
      return { id, name, url, status: "empty", http: res.status, chars: text.length, note: "page text too short — likely JS-rendered" };
    }
    if (text.length > maxChars) text = text.slice(0, maxChars) + "\n\n[truncated]";
    const header = `VENUE:${id} | ${name}\nURL:${res.url || url}\nFETCHED:${new Date().toISOString()}\n\n`;
    await writeFile(path.join(OUT_DIR, `${id}.txt`), header + text);
    return { id, name, url, status: "ok", http: res.status, chars: text.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id, name, url, status: "error", note: msg.slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const only = arg("--venue");
  const maxChars = Number(arg("--max-kb") ?? "40") * 1024;

  const locations = await loadLocations();
  const targets = locations
    .filter((l) => l.status === "active" && l.scrape_tier === 3 && l.event_sources[0]?.url)
    .filter((l) => !only || l.id === only)
    .sort((a, b) => b.relevance_score - a.relevance_score);

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const reports: Report[] = [];
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const l = targets[i++];
      const r = await fetchOne(l.id, l.name, l.event_sources[0].url, maxChars);
      reports.push(r);
      const tag = r.status === "ok" ? `ok ${Math.round((r.chars ?? 0) / 1024)}KB` : `${r.status}${r.http ? " " + r.http : ""}${r.note ? " — " + r.note : ""}`;
      console.log(`${l.id.padEnd(30)} ${tag}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  reports.sort((a, b) => a.id.localeCompare(b.id));
  const summary = {
    fetched_at: new Date().toISOString(),
    total: reports.length,
    ok: reports.filter((r) => r.status === "ok").length,
    empty: reports.filter((r) => r.status === "empty").length,
    http: reports.filter((r) => r.status === "http").length,
    error: reports.filter((r) => r.status === "error").length,
    venues: reports,
  };
  await writeFile(path.join(OUT_DIR, "_report.json"), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.ok}/${summary.total} venues fetched (${summary.empty} empty, ${summary.http} http errors, ${summary.error} network errors) -> ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
