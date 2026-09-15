/**
 * Mailing-list inbox agent — fetch stage. Connects to the dedicated
 * newsletter inbox over IMAP, pulls new messages, and writes each one to
 * data/inbox/ for Claude to parse (Tier 3 on email HTML). A manifest tracks
 * what has been fetched and what has been processed into events.
 *
 * Credentials come from .env in the project root (never committed):
 *   SCOUT_EMAIL=eventscout.xyz@gmail.com
 *   SCOUT_EMAIL_PASSWORD=<gmail app password>   # requires 2-Step Verification
 *   SCOUT_IMAP_HOST=imap.gmail.com              # optional, this is the default
 *
 * Usage:
 *   npx tsx src/scripts/fetch-inbox.ts                    # fetch new messages since last run
 *   npx tsx src/scripts/fetch-inbox.ts --limit 20         # cap messages fetched this run
 *   npx tsx src/scripts/fetch-inbox.ts --all              # refetch everything in the inbox
 *   npx tsx src/scripts/fetch-inbox.ts --mark-processed 101,102   # flag manifest entries done
 *   npx tsx src/scripts/fetch-inbox.ts --status           # show manifest summary
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const INBOX_DIR = "data/inbox";
const MANIFEST = path.join(INBOX_DIR, "manifest.json");

interface ManifestEntry {
  uid: number;
  from: string;
  subject: string;
  date: string; // ISO
  file: string; // relative path to saved body
  processed: boolean; // true once events were extracted & ingested
}

function loadEnv(): void {
  const envPath = ".env";
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

async function loadManifest(): Promise<ManifestEntry[]> {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf-8"));
  } catch {
    return [];
  }
}

async function saveManifest(entries: ManifestEntry[]): Promise<void> {
  await mkdir(INBOX_DIR, { recursive: true });
  entries.sort((a, b) => a.uid - b.uid);
  await writeFile(MANIFEST, JSON.stringify(entries, null, 2), "utf-8");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    const manifest = await loadManifest();
    const pending = manifest.filter((e) => !e.processed);
    console.log(`Inbox manifest: ${manifest.length} messages fetched, ${pending.length} unprocessed.`);
    for (const e of pending.slice(0, 25)) {
      console.log(`  [${e.uid}] ${e.date.slice(0, 10)} | ${e.from.slice(0, 30).padEnd(30)} | ${e.subject.slice(0, 60)}`);
    }
    if (pending.length > 25) console.log(`  ... and ${pending.length - 25} more`);
    return;
  }

  const markIdx = args.indexOf("--mark-processed");
  if (markIdx >= 0) {
    const uids = (args[markIdx + 1] ?? "").split(",").map((s) => parseInt(s, 10));
    const manifest = await loadManifest();
    let marked = 0;
    for (const e of manifest) {
      if (uids.includes(e.uid) && !e.processed) {
        e.processed = true;
        marked++;
      }
    }
    await saveManifest(manifest);
    console.log(`Marked ${marked} message(s) processed.`);
    return;
  }

  const email = process.env.SCOUT_EMAIL;
  const password = process.env.SCOUT_EMAIL_PASSWORD;
  const host = process.env.SCOUT_IMAP_HOST ?? "imap.gmail.com";
  if (!email || !password) {
    console.error(
      "Missing credentials. Create a .env file in the project root with:\n" +
        "  SCOUT_EMAIL=<address>\n  SCOUT_EMAIL_PASSWORD=<gmail app password>\n" +
        "See docs/mailing-list-agent.md for setup."
    );
    process.exit(1);
  }

  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 50;
  const refetchAll = args.includes("--all");

  const manifest = await loadManifest();
  const lastUid = refetchAll ? 0 : manifest.reduce((max, e) => Math.max(max, e.uid), 0);

  console.log(`Connecting to ${host} as ${email} ...`);
  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  let fetched = 0;
  try {
    const range = `${lastUid + 1}:*`;
    for await (const msg of client.fetch(
      { uid: range },
      { uid: true, source: true },
      { uid: true }
    )) {
      if (msg.uid <= lastUid) continue; // IMAP returns the last message even when none are new
      if (fetched >= limit) break;
      if (!msg.source) continue;

      const parsed = await simpleParser(msg.source);
      const from = parsed.from?.text ?? "unknown";
      const subject = parsed.subject ?? "(no subject)";
      const date = (parsed.date ?? new Date()).toISOString();

      const body = parsed.html || parsed.textAsHtml || parsed.text || "";
      const ext = parsed.html || parsed.textAsHtml ? "html" : "txt";
      const file = path.join(INBOX_DIR, `${msg.uid}-${slugify(subject)}.${ext}`);
      await mkdir(INBOX_DIR, { recursive: true });
      await writeFile(file, body, "utf-8");

      manifest.push({ uid: msg.uid, from, subject, date, file, processed: false });
      fetched++;
      console.log(`  [${msg.uid}] ${from.slice(0, 35).padEnd(35)} | ${subject.slice(0, 60)}`);
    }
  } finally {
    lock.release();
    await client.logout();
  }

  await saveManifest(manifest);
  const pending = manifest.filter((e) => !e.processed).length;
  console.log(`\nFetched ${fetched} new message(s). ${pending} unprocessed in manifest.`);
  if (pending > 0) {
    console.log(`Run '/scout inbox' to parse them into events.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
