/**
 * Email the weekly digest (output/digest/latest.html) via Gmail SMTP from the
 * scout account. Reads credentials from the environment (or .env locally):
 *
 *   SCOUT_EMAIL            sender (the dedicated scout Gmail)
 *   SCOUT_EMAIL_PASSWORD   Gmail app password (same one used for IMAP)
 *   DIGEST_TO              recipient address
 *
 * Usage:
 *   npx tsx src/scripts/send-digest.ts             # send output/digest/latest.html
 *   npx tsx src/scripts/send-digest.ts --dry-run   # print what would be sent
 */

import { readFile } from "fs/promises";
import nodemailer from "nodemailer";

async function loadDotEnv() {
  try {
    const raw = await readFile(".env", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env — rely on real environment (CI)
  }
}

async function main() {
  await loadDotEnv();
  const dryRun = process.argv.includes("--dry-run");

  const from = process.env.SCOUT_EMAIL;
  const pass = process.env.SCOUT_EMAIL_PASSWORD;
  const to = process.env.DIGEST_TO;
  if (!from || !pass || !to) {
    console.error("Missing SCOUT_EMAIL, SCOUT_EMAIL_PASSWORD, or DIGEST_TO.");
    process.exit(1);
  }

  const html = await readFile("output/digest/latest.html", "utf-8");
  const text = await readFile("output/digest/latest.md", "utf-8");
  const meta = JSON.parse(await readFile("output/digest/latest.json", "utf-8")) as { title: string; count: number };

  if (dryRun) {
    console.log(`[dry-run] From: ${from}\nTo: ${to}\nSubject: ${meta.title}\n${html.length} bytes HTML, ${meta.count} events`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SCOUT_SMTP_HOST ?? "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: from, pass },
  });

  const info = await transporter.sendMail({
    from: `"NYC Event Scout" <${from}>`,
    to,
    subject: meta.title,
    text,
    html,
  });
  console.log(`Sent "${meta.title}" to ${to} (${info.messageId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
