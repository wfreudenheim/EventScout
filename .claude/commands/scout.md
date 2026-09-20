---
description: NYC Event Scout — sweep venues, parse events, score, stage, and report
argument-hint: full | venue "Name" | category "film" | aggregators | inbox | audit | discover "area" | seasonal | review | add-venue | status
---

You are the Event Scout agent runtime. Parse the subcommand from: `$ARGUMENTS`

All commands run from the project root. The Tier 3 pipeline is: fetch a venue's event page yourself (WebFetch), extract events as JSON using your own intelligence, then hand the JSON to the ingest script, which scores (hybrid: max of your score and keyword score), applies the score floor and per-venue cap, deduplicates, stages, and logs.

## Shared Tier 3 loop (used by `full`, `venue`, `category`)

For each target venue:

1. `npx tsx src/cli/index.ts context "<venue name or id>"` — prints the venue's source URLs, scrape notes, and the exact extraction prompt to use.
2. WebFetch the venue's source URL with that extraction prompt. If the site 403s or is JS-rendered and returns nothing useful, note it and check `scrape_notes` for an alternative (several venues have Eventbrite fallbacks); if there is no alternative, skip and report it.
3. Write the resulting JSON array (raw parsed events) to `data/tmp/<venue-id>.json`.
4. `npx tsx src/scripts/ingest-tier3.ts <venue-id> data/tmp/<venue-id>.json` — this scores, dedupes, stages, updates `last_checked`, and logs the run.
5. Note the summary counts it prints.

Parse events for **next month and anything further out you find**. Skip clearly irrelevant listings (children's programs, private galas) — the prompt covers this.

## Subcommands

### `full` — full sweep of all active venues (tier-routed)
1. `npx tsx src/cli/index.ts archive` — move past events out of the active set first.
2. Run the `inbox` subcommand flow — newsletters cover the scrape-blocked venues, so process them before deciding which venues still need fetching. **Cloud/unattended runs:** there are no IMAP credentials; the inbox GitHub Action has already fetched newsletters and committed them as stripped text in `data/inbox/txt/<uid>.txt` — parse those directly (see inbox step 3b) and skip `fetch-inbox.ts`. If `data/inbox/txt/` is empty and `.env` is missing, skip the inbox step and note it in the summary.
3. `npx tsx src/scripts/prepare-run.ts` — lists all active venues by relevance with batch plan; writes `data/tmp/run-plan.json`.
4. Route each venue by its `scrape_tier`:
   - **Tier 1** (structured source): `npx tsx src/scripts/fetch-eventbrite.ts <venue-id>` or `npx tsx src/scripts/fetch-rss.ts <venue-id>`. IMPORTANT: before ingesting, read the fetched JSON and add `interest_score`/`matched_categories` yourself — automated fetches carry no scores, and keyword-only scoring drops good events at the floor (proven 2026-07: all 20 Caveat events dropped until scored). Then ingest: Eventbrite search-page results via `ingest-aggregator.ts eventbrite <file>` (search pages mix in other venues' events — venue matching filters them); organizer pages or RSS via `ingest-tier3.ts <venue-id> <file>`.
   - **Tier 2** (generated scraper): `npx tsx src/scripts/run-scraper.ts <venue-id>` — fetches, scrapes, and ingests in one step. Exit code 2 = scraper failed; treat that venue as Tier 3 for this run and consider regenerating its scraper (see "Tier 2 generation" below).
   - **Tier 3** (default): run the Tier 3 loop. Work in batches of ~5; you may parallelize WebFetches within a batch, but run ingest scripts sequentially (they read-modify-write shared JSON files — concurrent ingests will lose data).
5. When done: regenerate outputs (see "Wrap-up" below) and give a summary — venues checked, events found/staged, failures worth noting, and the top ~10 highest-scored new events.

### `venue "Name"` — single venue sweep
Run the Tier 3 loop for just that venue, then wrap up and summarize what was found.

### `category "film"` — sweep venues in one category
`npx tsx src/scripts/prepare-run.ts --category <cat>` to get the target list, then run the Tier 3 loop for each, wrap up, summarize.

### `aggregators` — community calendar sources
1. Read `data/aggregators.json` for the active aggregator sources (Screen Slate, Thought Gallery, cal.red, NYC Noise).
2. For each: WebFetch its URL with the **aggregator prompt** (same as the venue prompt but every event must include a `venue_name` field — see `buildAggregatorPrompt` in `src/utils/prompts.ts` for the exact text). Focus on the next 4–8 weeks.
3. Write results to `data/tmp/<aggregator-id>.json`.
4. `npx tsx src/scripts/ingest-aggregator.ts <aggregator-id> data/tmp/<aggregator-id>.json` — fuzzy-matches venue names to the registry, ingests per-venue, and reports unmatched venues.
5. Review the unmatched-venues report with the user: interesting ones → `add-venue` (or re-run ingest with `--create-pending` to stage everything under pending registry entries). Cross-source dedup is automatic (fuzzy title+date matching per venue).

### `inbox` — mailing-list agent (see docs/mailing-list-agent.md)
1. `npx tsx src/scripts/fetch-inbox.ts --limit 300` — pulls new newsletters into `data/inbox/` (needs `.env` credentials; if missing, point the user at docs/mailing-list-agent.md setup). Then `npx tsx src/scripts/inbox-to-text.ts` to convert them to stripped text in `data/inbox/txt/` (tracking links and footers removed — far cheaper to read than the HTML).
2. `npx tsx src/scripts/fetch-inbox.ts --status` — list unprocessed messages.
3. Triage by sender/subject first: skip international art-fair/press announcements (e-flux Agenda, e-flux Film), donation and membership asks, day-of daily picks (Screen Slate dailies), and anything whose dates have passed. Read the rest from `data/inbox/txt/<uid>.txt` (3b: in cloud runs these files are the only copy — the HTML is not in the repo). Extract events as JSON (same fields as the aggregator prompt — every event needs `venue_name`; score against the interest profile; the sender usually IS the venue). Newsletters also carry open calls, application deadlines, and early ticket announcements — collect these separately for the summary.
4. Write all extracted events to `data/tmp/inbox-batch.json`, then `npx tsx src/scripts/ingest-aggregator.ts inbox data/tmp/inbox-batch.json`.
5. Mark ALL triaged messages done (skipped ones too): `npx tsx src/scripts/fetch-inbox.ts --mark-processed <uid1>,<uid2>,...`, then `npx tsx src/scripts/inbox-to-text.ts --prune` to drop their text files.
6. Report: events staged, open calls/deadlines found, unmatched venues worth adding.

### `audit` — venue registry audit
1. `npx tsx src/scripts/audit-venues.ts` (options: `--limit N`, `--venue <id>`, `--include-pending`) — tests every venue URL, detects blocks/JS-rendering/structured markup/Eventbrite/RSS links, writes `data/audit.json` with a recommended tier per venue.
2. Review the report and apply what's clear-cut: update `scrape_tier`, `structured_source`, and `scrape_notes` in `data/locations.json` for venues with confirmed Tier 1 sources or persistent blocks. Summarize changes for the user.

### Tier 2 generation — after a clean Tier 3 parse
When a venue's page is server-rendered with stable, repeated markup (audit says "Tier 2 candidate", or you noticed clean structure while parsing):
1. Copy `scrapers/_template.ts` to `scrapers/<venue-id>.ts` and write real selectors based on the HTML you just parsed.
2. Test: `npx tsx src/scripts/run-scraper.ts <venue-id> --dry-run` — compare output to your Tier 3 parse.
3. If it matches, set the venue's registry entry: `"scrape_tier": 2, "generated_scraper": "scrapers/<venue-id>.ts"`. Future `full` sweeps will run it automatically and fall back to Tier 3 if it breaks.

### `discover "Ridgewood"` — discovery mode
Search the web (WebSearch) for cultural venues/events in the named neighborhood or theme that are NOT in `data/locations.json`. For promising finds, propose additions and on approval add via `npx tsx src/cli/index.ts add-venue --name ... --url ... --neighborhood ... --categories ...`.

### `seasonal` — seasonal look-ahead
Read `docs/nyc-seasonal-calendar.md`, identify events whose typical month is within the next 2–3 months, check their source URLs for announced dates/programs, and report a "Coming Up" summary. (Dedicated `seasonal_events.json` tracking is Phase 4.)

### `review` — review staged events
1. `npx tsx src/cli/index.ts review` — lists staged events with scores.
2. Present them grouped by score, ask the user what to approve, then apply with `--auto-approve <score>` or `--approve-all`.

### `add-venue` — add a venue interactively
Ask the user for name, URL, type, neighborhood, categories (or take them from their message), then run `npx tsx src/cli/index.ts add-venue` with the flags.

### `status` — system status
`npx tsx src/cli/index.ts status` and relay, adding anything noteworthy (stale data warnings, venues never successfully checked).

## Wrap-up (after any sweep that staged events)

1. `npx tsx src/cli/index.ts calendar --weeks 6 --min-score 2 --output output/calendar.md`
2. If the user uses the web UI, refresh its data copy: `cd ui && npm run sync-data`
3. `npx tsx src/scripts/build-digest.ts` — refresh the weekly digest (`output/digest/latest.html`, also copied into the site).
4. **Cloud/unattended runs only:** work on a `claude/sweep-<date>` branch from the start, commit as you go, and finish with `git push -u origin HEAD` — the merge-sweep GitHub Action merges it into main and redeploys the site. Never push to main from a routine (rejected once main has commits by other authors), never open a PR, never commit `.env` or `data/inbox/*.html`. Tier 1 results are pre-fetched by the Prefetch Action into `data/prefetch/<venue-id>-eb.json` (unscored — score them, then `ingest-aggregator.ts eventbrite <file>`); Tier 2 scrapers already ran there; Tier 3 venue pages are pre-fetched as text into `data/prefetch/venues/<venue-id>.txt` (with `_report.json` listing venues that 403'd / were empty) — parse those instead of WebFetch, in batches via subagents, and ingest each batch with `ingest-aggregator.ts web-sweep <file>`.
5. Interactive runs: remind the user to run `/scout review` to approve staged events.

## Scoring calibration notes

Beyond the prompt's interest list: interdisciplinary events outrank single-genre ones; embodied/site-specific work rates 5; "nerd-coded" framing is a turnoff; experimental alone doesn't mean 5. Author talks with speculative/sci-fi writers score 4–5 (user feedback 2026-07). When your score and the keyword score disagree, the max wins — so be conservative with 4–5s.

Balance check: if a sweep's results skew heavily toward one format (e.g. screenings), flag it — it usually means the talk/academic venues failed to scrape, not that nothing is happening. Academic venues (Columbia, CUNY GC, NYU centers) are 403-walled; their events arrive via the future mailing-list agent, Thought Gallery sweeps, and manual adds.
