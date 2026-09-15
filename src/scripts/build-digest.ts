/**
 * Build the weekly digest: the coming week's events (today through +7 days),
 * grouped by day, with the top picks called out. Writes:
 *
 *   output/digest/latest.html   — email-safe HTML (inline styles, single column)
 *   output/digest/latest.md     — same content as markdown
 *   output/digest/YYYY-MM-DD.html / .md — dated copies
 *   ui/public/digest/latest.html — copy served by the static site
 *
 * Deterministic (no Claude needed) so it can run on a GitHub Actions cron.
 *
 * Usage:
 *   npx tsx src/scripts/build-digest.ts                 # week starting today
 *   npx tsx src/scripts/build-digest.ts --from 2026-09-20 --days 7 --min-score 3
 */

import { mkdir, writeFile, copyFile } from "fs/promises";
import path from "path";
import { loadEvents, loadStagedEvents, loadLocations } from "../utils/data.js";
import type { Event, Location } from "../types/index.js";

const SITE_URL = process.env.SITE_URL ?? "https://wfreudenheim.github.io/EventScout/";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

function fmtDay(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtShort(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function venueName(ev: Event, locs: Map<string, Location>): string {
  return locs.get(ev.venue_id)?.name ?? ev.venue_name ?? ev.venue_id;
}

function neighborhood(ev: Event, locs: Map<string, Location>): string {
  return locs.get(ev.venue_id)?.neighborhood ?? "";
}

function priceLabel(p?: string): string {
  if (!p) return "";
  if (p.toLowerCase() === "free") return "free";
  if (p.toLowerCase() === "varies") return "";
  return p;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

async function main() {
  const from = arg("--from", isoDate(new Date()));
  const days = Number(arg("--days", "7"));
  const minScore = Number(arg("--min-score", "3"));
  const to = addDays(from, days);

  const [approved, staged, locations] = await Promise.all([loadEvents(), loadStagedEvents(), loadLocations()]);
  const locs = new Map(locations.map((l) => [l.id, l]));

  const seen = new Set<string>();
  const inWindow = [...approved, ...staged]
    .filter((e) => e.date >= from && e.date <= to && e.interest_score >= minScore)
    .filter((e) => {
      const key = `${e.venue_id}|${e.date}|${e.title.toLowerCase().slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time_start ?? "99").localeCompare(b.time_start ?? "99"));

  const picks = [...inWindow]
    .sort((a, b) => b.interest_score - a.interest_score || a.date.localeCompare(b.date))
    .slice(0, 6);

  const byDay = new Map<string, Event[]>();
  for (const e of inWindow) {
    const g = byDay.get(e.date) ?? [];
    g.push(e);
    byDay.set(e.date, g);
  }

  const belowFloor = [...approved, ...staged].filter(
    (e) => e.date >= from && e.date <= to && e.interest_score < minScore && e.interest_score >= 2
  ).length;

  const title = `Event Scout · Week of ${fmtShort(from)}`;

  // ---------- HTML (email-safe: inline styles, one column, no scripts) ----------
  const css = {
    body: "margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2a2a2a;",
    wrap: "max-width:600px;margin:0 auto;padding:24px 16px;",
    h1: "font-size:20px;font-weight:600;margin:0 0 4px;",
    sub: "font-size:13px;color:#7a7a7a;margin:0 0 24px;",
    h2: "font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7f6a;margin:28px 0 8px;padding-bottom:6px;border-bottom:1px solid #e2e2df;",
    item: "padding:10px 0;border-bottom:1px solid #ececea;",
    time: "font-size:12px;color:#9b9b9b;",
    ttl: "font-size:15px;font-weight:500;color:#2a2a2a;text-decoration:none;",
    meta: "font-size:13px;color:#6a6a6a;margin-top:2px;",
    desc: "font-size:13px;color:#555;margin-top:4px;line-height:1.45;",
    score: "display:inline-block;font-size:11px;color:#6b7f6a;border:1px solid #c9d2c8;border-radius:3px;padding:0 5px;margin-left:6px;vertical-align:middle;",
    foot: "font-size:12px;color:#9b9b9b;margin-top:32px;line-height:1.5;",
    btn: "display:inline-block;font-size:13px;color:#fff;background:#6b7f6a;text-decoration:none;padding:8px 14px;border-radius:4px;margin-top:8px;",
  };

  const itemHtml = (e: Event, showDay = false) => {
    const t = fmtTime(e.time_start);
    const price = priceLabel(e.price);
    const metaBits = [venueName(e, locs), neighborhood(e, locs), price].filter(Boolean).join(" · ");
    const when = [showDay ? fmtShort(e.date) : "", t].filter(Boolean).join(" · ");
    const ttl = e.url
      ? `<a href="${esc(e.url)}" style="${css.ttl}">${esc(e.title)}</a>`
      : `<span style="${css.ttl}">${esc(e.title)}</span>`;
    return `<div style="${css.item}">
      ${when ? `<div style="${css.time}">${esc(when)}</div>` : ""}
      <div>${ttl}<span style="${css.score}">${e.interest_score}</span></div>
      <div style="${css.meta}">${esc(metaBits)}</div>
      ${e.description ? `<div style="${css.desc}">${esc(truncate(e.description, 220))}</div>` : ""}
    </div>`;
  };

  let html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="${css.body}"><div style="${css.wrap}">
<h1 style="${css.h1}">${esc(title)}</h1>
<p style="${css.sub}">${inWindow.length} events scoring ${minScore}+ from ${fmtShort(from)} to ${fmtShort(to)}${belowFloor ? ` · ${belowFloor} more at score 2 on the site` : ""}</p>`;

  if (picks.length) {
    html += `<h2 style="${css.h2}">Top picks</h2>` + picks.map((e) => itemHtml(e, true)).join("");
  }

  for (const [day, evs] of byDay) {
    html += `<h2 style="${css.h2}">${esc(fmtDay(day))}</h2>` + evs.map((e) => itemHtml(e)).join("");
  }

  if (inWindow.length === 0) {
    html += `<p style="${css.desc}">Nothing scoring ${minScore}+ this week. Either the sweep hasn't run or it's a quiet week.</p>`;
  }

  html += `<a href="${esc(SITE_URL)}" style="${css.btn}">Open the full calendar →</a>
<p style="${css.foot}">Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by NYC Event Scout. Scores are 0–5 against your interest profile; events are auto-staged, not hand-approved.</p>
</div></body></html>`;

  // ---------- Markdown ----------
  const itemMd = (e: Event, showDay = false) => {
    const when = [showDay ? fmtShort(e.date) : "", fmtTime(e.time_start)].filter(Boolean).join(" · ");
    const meta = [venueName(e, locs), neighborhood(e, locs), priceLabel(e.price)].filter(Boolean).join(" · ");
    const t = e.url ? `[${e.title}](${e.url})` : e.title;
    return `- ${when ? `**${when}** — ` : ""}${t} (${e.interest_score})  \n  ${meta}${e.description ? `  \n  ${truncate(e.description, 220)}` : ""}`;
  };
  let md = `# ${title}\n\n${inWindow.length} events scoring ${minScore}+ from ${fmtShort(from)} to ${fmtShort(to)}.\n`;
  if (picks.length) md += `\n## Top picks\n\n${picks.map((e) => itemMd(e, true)).join("\n")}\n`;
  for (const [day, evs] of byDay) md += `\n## ${fmtDay(day)}\n\n${evs.map((e) => itemMd(e)).join("\n")}\n`;
  md += `\n---\n[Full calendar](${SITE_URL})\n`;

  // ---------- Write ----------
  const outDir = "output/digest";
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "latest.html"), html);
  await writeFile(path.join(outDir, "latest.md"), md);
  await writeFile(path.join(outDir, `${from}.html`), html);
  await writeFile(path.join(outDir, `${from}.md`), md);
  await writeFile(path.join(outDir, "latest.json"), JSON.stringify({ title, from, to, count: inWindow.length }, null, 2));

  const siteDir = "ui/public/digest";
  await mkdir(siteDir, { recursive: true });
  await copyFile(path.join(outDir, "latest.html"), path.join(siteDir, "latest.html"));

  console.log(`${title}: ${inWindow.length} events (${picks.length} picks) -> ${outDir}/latest.{html,md}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
