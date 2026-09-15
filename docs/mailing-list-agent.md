# Mailing-List Inbox Agent

The fix for venues whose websites can't be scraped (bot walls, JS apps, broken
sites): subscribe a dedicated email address to their newsletters, then treat
the inbox as a Tier 1 source. Newsletters are structured, reliable, and often
announce events *before* they hit websites.

## How it works

```
newsletters → dedicated Gmail inbox
                │
                ▼
  fetch-inbox.ts (IMAP, automated)          ── pulls new emails → data/inbox/*.html + manifest.json
                │
                ▼
  /scout inbox (Claude, per sweep)          ── reads each email, extracts events w/ venue_name + scores
                │
                ▼
  ingest-aggregator.ts inbox <file>         ── venue matching, dedup, staging (same pipeline as aggregators)
```

Cross-source dedup already handles the overlap case (same event in a newsletter
and on a venue page).

## One-time setup (manual — ~15 min)

1. **Create a dedicated Gmail** (e.g. `eventscout.nyc@gmail.com`). Dedicated
   (not your personal) so the inbox contains *only* venue newsletters — the
   parser assumes everything in it is event-relevant.
2. **Enable 2-Step Verification** on the account (Google account settings →
   Security). Required for the next step.
3. **Create an App Password**: Google account → Security → 2-Step
   Verification → App passwords → create one named "eventscout". Copy the
   16-character password.
4. **Create `.env`** in the project root (never committed anywhere):
   ```
   SCOUT_EMAIL=eventscout.nyc@gmail.com
   SCOUT_EMAIL_PASSWORD=abcd efgh ijkl mnop
   ```
5. **Verify**: `npx tsx src/scripts/fetch-inbox.ts` should connect and report
   0 messages.

## Subscription checklist (manual — do in one sitting, ~45 min)

Subscribe with the dedicated address. Signup forms are almost always in the
site footer or under "Newsletter" / "Mailing List". Priority order:

**Tier A — scrape-blocked, high interest (the whole reason this agent exists):**
- [ ] e-flux (e-flux.com — "subscribe": announcements + program; the single densest art/theory source)
- [ ] Rhizome (rhizome.org)
- [ ] MoMA (moma.org footer)
- [ ] Film at Lincoln Center (filmlinc.org)
- [ ] Museum of the Moving Image (movingimage.us)
- [ ] The Shed (theshed.org)
- [ ] New Museum (newmuseum.org)
- [ ] The Kitchen (thekitchen.org)
- [ ] CUNY Graduate Center public programs (gc.cuny.edu — look for "Public Programs" mailing list)
- [ ] Columbia: School of the Arts / Lenfest (arts.columbia.edu), Zuckerman Institute (zuckermaninstitute.columbia.edu), Center for Science & Society (scienceandsociety.columbia.edu), Heyman Center / Society of Fellows
- [ ] NYU: Center for Data Science, ITP/IMA (itp.nyu.edu), Center for Neural Science colloquia list
- [ ] The New School / Vera List Center (veralistcenter.org)
- [ ] Printed Matter (printedmatter.org)
- [ ] Storefront for Art and Architecture (storefrontnews.org)
- [ ] Secret Science Club (secretscienceclub.com — blog sidebar)
- [ ] The Stone (site broken — Instagram @thestonenyc or the New School COPA list)

**Tier B — scrapeable but newsletters announce earlier / more completely:**
- [ ] Light Industry (their emails are the canonical announcement channel)
- [ ] Anthology Film Archives
- [ ] Screen Slate daily email (screenslate.com — this alone covers most microcinema)
- [ ] Pioneer Works (Broadcast newsletter)
- [ ] Roulette
- [ ] ISSUE Project Room
- [ ] SFPC (sfpc.study)
- [ ] Vera List Center
- [ ] Do Not Research (substack — already tracked via RSS but email gets everything)

**Tier C — long tail, add over time:**
- [ ] NYC Resistor, Genspace, Eyebeam, Triple Canopy, Bard Graduate Center,
      NYAS, Simons Foundation, Van Alen Institute, Architectural League,
      e-flux Architecture, Topos Bookstore, small galleries as you find them

## Ongoing workflow

- `/scout inbox` — fetches new mail and parses it into staged events. Run it
  standalone anytime, and it also runs as part of every `/scout full` sweep.
- The manifest (`data/inbox/manifest.json`) tracks processed state, so
  re-running never double-ingests. Cadence: whatever the sweep cadence is —
  newsletters just accumulate until then.
- Application deadlines, open calls, and early ticket announcements found in
  newsletters get reported in the sweep summary even when they aren't
  calendar events.

## Costs & caveats

- Gmail free tier is plenty (newsletters are ~50–200/month).
- App passwords require keeping 2FA on the account.
- `.env` holds the app password: it stays local, and this project is not a
  git repo — if it ever becomes one, add `.env` to `.gitignore` first.
- Some venues (MoMA especially) send marketing-heavy mail; the parser scores
  against the interest profile, so noise dies at the score floor.
