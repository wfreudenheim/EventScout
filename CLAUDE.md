# NYC Event Scout

Personal event discovery system for NYC cultural events. Claude Code is the runtime — agents use Claude's intelligence to read venue pages, parse events, score against interests, and write structured data to local JSON files. A separate local web UI reads those files.

## Project Structure

```
data/               — JSON data files (locations, events, interest profile, agent log)
src/types/          — TypeScript type definitions
src/utils/          — Data access, scoring, calendar generation
src/agents/         — Agent logic (venue scraping, dispatching)
src/cli/            — CLI entry point (orchestration layer)
docs/               — Spec documents, seed lists, seasonal calendar
output/             — Generated outputs (calendars, reports)
scrapers/           — Generated Tier 2 scraper scripts (future)
```

## Slash Commands

Implemented in `.claude/commands/scout.md` (orchestration playbook per subcommand).

- `/scout full` — Full sweep of all active locations
- `/scout venue "Name"` — Single venue sweep
- `/scout category "film"` — Sweep all venues in a category
- `/scout aggregators` — Hit community calendar sources
- `/scout discover "Ridgewood"` — Discovery mode for a neighborhood/theme
- `/scout seasonal` — Check seasonal calendar, look ahead 2-3 months
- `/scout review` — Review and approve staged events
- `/scout add-venue` — Add a new venue interactively
- `/scout status` — System status summary

## Scraping Tiers

- **Tier 1**: Structured sources (Eventbrite API, RSS, Luma) — automated scripts, no Claude needed
- **Tier 2**: Generated scrapers — Claude writes a reusable script on first parse, runs automatically after
- **Tier 3**: Claude-powered parsing — Claude reads HTML directly, extracts events. Default for Phase 1.

## Key Data Files

- `data/locations.json` — Venue/org registry (37 seed entries)
- `data/events.json` — Approved events
- `data/staged_events.json` — Events pending review
- `data/interest_profile.json` — 14 weighted interest categories
- `data/agent_log.json` — Agent run history

## Run Cadence

Automated (see docs/automation.md): the Prefetch GitHub Action fetches newsletters + Tier 1/2 Wed + Sun 1:30am ET, a Claude cloud routine runs `/scout full` at 2am ET and pushes a `claude/sweep-<date>` branch that an Action merges into main, GitHub Pages redeploys the site on push, and the digest Action emails the week ahead Sunday 8:30am ET. Manual runs still work the same way. Agents search next month + anything further out they find. Merges with existing data, deduplicates, archives past events.

## Commands

```bash
npx tsx src/cli/index.ts run              # Full sweep (Tier 2 cheerio — future use)
npx tsx src/cli/index.ts run --venue "X"  # Single venue
npx tsx src/cli/index.ts context "X"      # Venue URLs + Tier 3 extraction prompt
npx tsx src/cli/index.ts archive          # Move past events to data/archive/YYYY-MM.json (--dry-run supported)
npx tsx src/cli/index.ts calendar         # Generate calendar
npx tsx src/cli/index.ts locations        # Venue directory
npx tsx src/cli/index.ts review           # Review staged events
npx tsx src/cli/index.ts status           # System status
npx tsx src/cli/index.ts add-venue        # Add venue

# Tier 3 ingest (after Claude parses a venue page):
npx tsx src/scripts/prepare-run.ts                          # Build run plan for all active venues
npx tsx src/scripts/ingest-tier3.ts <venue-id> <json-file>  # Score, dedupe, stage parsed events

# Phase 3 tooling:
npx tsx src/scripts/ingest-aggregator.ts <agg-id> <file>    # Aggregator ingest w/ venue matching (--create-pending)
npx tsx src/scripts/fetch-eventbrite.ts <venue-id|url>      # Tier 1: Eventbrite JSON-LD extraction
npx tsx src/scripts/fetch-rss.ts <venue-id|url>             # Tier 1: RSS/Atom feed parsing
npx tsx src/scripts/run-scraper.ts <venue-id>|--all         # Tier 2: run generated scrapers (--dry-run)
npx tsx src/scripts/audit-venues.ts                         # Audit venue URLs, recommend tiers -> data/audit.json
npx tsx src/scripts/fetch-inbox.ts [--status|--all]         # Mailing-list agent: pull newsletters via IMAP (needs .env)
npx tsx src/scripts/inbox-to-text.ts [--all|--prune]        # Newsletters -> stripped text in data/inbox/txt (committed; cloud runs read these)
npx tsx src/scripts/build-digest.ts [--from YYYY-MM-DD]     # Weekly digest -> output/digest/latest.{html,md} + site copy
npx tsx src/scripts/send-digest.ts [--dry-run]              # Email the digest via Gmail SMTP (SCOUT_EMAIL/_PASSWORD, DIGEST_TO)

npm run serve                                                # Launch web UI (syncs data first)
```

Aggregator sources live in `data/aggregators.json`. Tier 2 scrapers live in `scrapers/` (copy `_template.ts`, see `/scout` playbook).
