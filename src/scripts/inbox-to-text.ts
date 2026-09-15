/**
 * Convert fetched newsletter HTML (data/inbox/*.html, gitignored) into stripped
 * plain-text files at data/inbox/txt/<uid>.txt that ARE committed. Tracking
 * URLs, invisible preheader padding, and footers are removed so the text is
 * small, readable, and free of personal unsubscribe tokens.
 *
 * The cloud sweep routine has no IMAP credentials, so the inbox GitHub Action
 * runs fetch-inbox.ts + this script and commits the result; the routine then
 * parses the .txt files.
 *
 * Usage:
 *   npx tsx src/scripts/inbox-to-text.ts            # convert unprocessed messages
 *   npx tsx src/scripts/inbox-to-text.ts --all      # convert everything in the manifest
 *   npx tsx src/scripts/inbox-to-text.ts --prune    # delete .txt files for processed messages
 */

import { readFile, writeFile, mkdir, readdir, unlink, access } from "fs/promises";
import path from "path";
import { convert } from "html-to-text";

const INBOX_DIR = "data/inbox";
const TXT_DIR = path.join(INBOX_DIR, "txt");
const MANIFEST = path.join(INBOX_DIR, "manifest.json");

interface ManifestEntry {
  uid: number;
  date?: string;
  from?: string;
  subject?: string;
  file: string;
  processed?: boolean;
}

const INVISIBLE = /[͏‌­​ ﻿‍⁠]/g;
const FOOTER =
  /(Copyright ©|Our mailing address|Want to change how you receive|unsubscribe|Update your preferences|You are receiving this|This email was sent to)[\s\S]*$/i;

export function htmlToScoutText(html: string): string {
  let txt = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
      { selector: "style", format: "skip" },
      { selector: "script", format: "skip" },
    ],
  });
  txt = txt.replace(INVISIBLE, "");
  txt = txt.replace(/https?:\/\/\S+/g, "");
  txt = txt
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
  txt = txt.replace(FOOTER, "");
  return txt.trim();
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const prune = args.includes("--prune");

  const manifest = JSON.parse(await readFile(MANIFEST, "utf-8")) as ManifestEntry[];
  await mkdir(TXT_DIR, { recursive: true });

  if (prune) {
    const processed = new Set(manifest.filter((e) => e.processed).map((e) => `${e.uid}.txt`));
    let removed = 0;
    for (const f of await readdir(TXT_DIR)) {
      if (processed.has(f)) {
        await unlink(path.join(TXT_DIR, f));
        removed++;
      }
    }
    console.log(`Pruned ${removed} processed text file(s).`);
    return;
  }

  const targets = manifest.filter((e) => all || !e.processed);
  let converted = 0;
  let missing = 0;
  let total = 0;
  for (const e of targets) {
    const src = path.resolve(e.file);
    if (!(await exists(src))) {
      missing++;
      continue;
    }
    const html = await readFile(src, "utf-8");
    const body = htmlToScoutText(html);
    const header = `UID:${e.uid} | ${(e.date ?? "").slice(0, 10)} | ${e.from ?? ""} | ${e.subject ?? ""}\n\n`;
    await writeFile(path.join(TXT_DIR, `${e.uid}.txt`), header + body);
    converted++;
    total += body.length;
  }
  console.log(
    `Converted ${converted} message(s) to ${TXT_DIR}/ (${Math.round(total / 1024)} KB)` +
      (missing ? `; ${missing} HTML file(s) missing (already cleaned up?)` : "")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
