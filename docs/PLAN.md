# NYC Event Scout — Implementation Plan

Living document. Check items off as completed.

---

## Phase 1: Foundation

Get `/scout venue "X"` working end-to-end: fetch a venue page, parse events, score and tag, write to staging. Deduplication from the start.

- [x] Project structure (TypeScript, package.json, directory layout)
- [x] Data schemas and TypeScript types (Location, Event, InterestProfile, AgentRun, SeasonalEvent)
- [x] Interest Profile config with 14 weighted categories
- [x] Seed Location Registry (37 venues with metadata, addresses, neighborhoods, source URLs)
- [x] Scrape tier fields added to Location schema (`scrape_tier`, `structured_source`, `generated_scraper`)
- [x] Data access layer (load/save locations, events, staged events, agent log, deduplication)
- [x] Scoring engine (keyword matching against interest profile, weighted by priority and category)
- [x] Format inference (gallery, talk, screening, performance, workshop, opening, music, etc.)
- [x] Cheerio-based venue agent (Tier 2 infrastructure for future use)
- [x] Agent dispatcher (orchestrates runs across venues, deduplicates, logs)
- [x] CLI entry point with commands: `run`, `calendar`, `locations`, `review`, `status`, `add-venue`
- [x] Markdown calendar generator (grouped by day, scored, filtered)
- [x] Venue directory generator (grouped by neighborhood, event counts, check dates)
- [x] CLAUDE.md project context file
- [x] **Tier 3 Claude-powered parsing** — WebFetch + Claude intelligence extracts events, scores relevance, tags categories. Proven against New Museum, Issue Project Room, Anthology Film Archives.
- [x] **Hybrid scoring** — Claude provides scores during Tier 3 extraction, keyword engine catches additional matches, takes the max. Both layers add value.
- [x] **Score floor filtering** — events below `min_score_to_stage` (default 1) are dropped at ingest. Truly irrelevant events (kids' workshops, comedy screenings) never enter the system. GUI defaults to showing score >= 2.
- [x] Test Tier 3 parsing against more diverse venues (university, hackerspace, aggregator) — proven across ~25 venues in March 2026 run (MoMA, Genspace, McNally Jackson, Verso, Elsewhere, etc.)
- [x] Cleanup/archive logic for past events on subsequent runs — `scout archive` (with `--dry-run`), stale-data warning in `scout status`
- [x] **Event archive** — past events move to `data/archive/YYYY-MM.json` monthly files so we can look back (`src/utils/archive.ts`)
- [x] `/scout full` runs all active venues end-to-end via Tier 3 — `.claude/commands/scout.md` orchestrates: archive → prepare-run → per-venue WebFetch + `scout context` prompt → ingest-tier3 → calendar + UI data refresh
- [x] `scout context <venue>` CLI command — prints venue source URLs, scrape notes, and the exact Tier 3 extraction prompt; single source of truth for the slash-command loop

## Phase 2: Local Web UI

Browsable event feed and venue directory served locally. Reads JSON data files — doesn't need Claude running.

- [x] Decide stack: Vite/React app in `ui/` (reads JSON copies from `ui/public/data/`, synced via `npm run sync-data`)
- [x] Event feed view — card layout grouped by day
  - [x] Event cards: title, date/time, venue + neighborhood, format badge, interest category pills, price, score indicator
  - [x] "View Page" button (opens source URL)
  - [x] "Add to Calendar" button (Google Calendar deep link with pre-filled fields)
- [x] Filter bar (persistent, top of page)
  - [x] Format: multi-select toggle chips
  - [x] Interest category: multi-select
  - [x] Cost: Free / Paid / All toggle
  - [x] Neighborhood filter
  - [x] Minimum interest score threshold
  - [x] Date range filter
- [x] Client-side filtering (instant, over local JSON)
- [x] Venue Directory view
  - [x] Name, neighborhood, category tags, upcoming event count, last checked, relevance score
  - [ ] "NEW" flag for discovery-agent additions
  - [ ] Click-through to see all events from that venue
- [x] Staging/review workflow — decided: stays CLI/slash-command based (`/scout review`); staged events shown in feed
- [x] Dev server command to launch — `npm run serve` at repo root (syncs data, starts Vite), plus `serve.bat`

## Phase 3: Agent Expansion & Tier 2 Generation

More agent types, community calendar scraping, and progressive automation of scraping.

- [x] `/scout category "film"` — sweep all venues in a category (`prepare-run.ts --category` + playbook)
- [x] `/scout aggregators` — community calendar sources (tooling complete; sweeps are runtime activity)
  - [x] Aggregator registry — `data/aggregators.json` (Screen Slate, Thought Gallery, cal.red, NYC Noise)
  - [x] Aggregator ingest pipeline — `ingest-aggregator.ts`: fuzzy venue matching (`src/utils/venues.ts`), per-venue ingest, unmatched-venue report, `--create-pending` for unknown venues
  - [x] Eventbrite integration — `fetch-eventbrite.ts` parses JSON-LD from organizer/search pages, no API key needed (tested live: 20 events from Pioneer Works search page)
  - [ ] First real aggregator sweeps (Screen Slate, Thought Gallery) — run via `/scout aggregators`
- [x] Org Agent logic — `venue_name` on parsed events + registry matching covers nomadic orgs; org events land at their host venue
- [x] Cross-source deduplication — fuzzy title matching (exact-normalized or distinctive-containment) + date + venue in `deduplicateEvents`
- [ ] Scoring refinement based on real-world usage (calibration set exists in `data/calibration.json`; playbook carries current insights)
- [ ] **Full venue audit** — tooling done (`audit-venues.ts`); full sweep + registry expansion pending:
  - [x] Audit script: tests each URL (status/redirect/JS-rendered), detects JSON-LD event markup, discovers RSS + Eventbrite links, recommends tier, writes `data/audit.json`
  - [ ] Run audit across full registry, apply tier tags + fixed URLs (spot check found: eyebeam 404, film-forum Tier 2 candidate, 3 RSS feeds)
  - [ ] Expand registry from 53 entries to full seed list (~200+) with validated metadata
  - [ ] Flag venues needing alternative strategies (Instagram-only, newsletter-only)
- [x] **Tier 2 scraper generation** — infrastructure complete; scrapers get written during sweeps
  - [x] Scraper script template (`scrapers/_template.ts` — scrape($, baseUrl) contract + date helper)
  - [x] Runner — `run-scraper.ts <id> | --all`: fetch, scrape, validate, ingest; `--dry-run` for testing
  - [x] Fallback to Tier 3 if Tier 2 script fails (exit 2 + failed run logged; playbook routes around it)
  - [x] Regeneration guidance in `/scout` playbook ("Tier 2 generation" section)
- [x] **Tier 1 identification** — fetchers done; tagging happens via audit
  - [x] Eventbrite fetcher (works for organizer pages, search pages, and as 403 fallback)
  - [x] RSS/Atom feed parsing — `fetch-rss.ts` (conservative: skips items without event dates; handles Substack /feed)
  - [ ] Luma API or structured scraping (no Luma sources in registry yet)
- [ ] **Mailing list inbox agent** — dedicated email subscribed to all venue/org mailing lists (tooling DONE 2026-07-24; account setup + subscriptions pending — see `docs/mailing-list-agent.md`)
  - [ ] Create dedicated inbox (Gmail + 2FA + app password → `.env`) — USER ACTION, ~15 min
  - [ ] Subscribe to venue newsletters (prioritized checklist in docs/mailing-list-agent.md; Tier A = the 403-walled venues: e-flux, Rhizome, MoMA, FLC, MoMI, The Shed, New Museum, The Kitchen, Columbia institutes, CUNY GC, NYU centers) — USER ACTION, ~45 min
  - [x] IMAP fetch script — `fetch-inbox.ts` (manifest-tracked, incremental, --status/--mark-processed)
  - [x] Parse event announcements from email HTML → same scoring/staging pipeline (`/scout inbox` playbook: Claude parses saved emails → `ingest-aggregator.ts inbox` with venue matching)
  - [x] Wired into `/scout full` (inbox runs first so blocked venues are covered before web fetching)
  - [x] Catches: early ticket announcements, one-off events, no-calendar venues, application deadlines (reported in sweep summary)

## Phase 4: Discovery, Seasonal & Full Orchestration

- [ ] `/scout discover "Ridgewood"` — search Eventbrite, Luma, Google for events in a neighborhood or theme, work backwards to find new venues
- [ ] `/scout seasonal` — check seasonal calendar, look ahead 2-3 months, update status, generate "Coming Up" summary
  - [ ] Seasonal events data file (`seasonal_events.json`) populated from `docs/nyc-seasonal-calendar.md`
  - [ ] Monthly check agent
  - [ ] Push confirmed seasonal events to main events database
- [ ] Institution Discovery Agent — find interesting events, work backwards to discover new venues
- [ ] Venue health tracking (broken scrapes, stale pages, venues with no events)
- [ ] `/scout status` enhancements (scrape success rates, tier breakdown, venue health)
- [ ] **Full tiered orchestration** — `/scout full` routes each venue through the right tier automatically
  - [ ] Run Tier 1 automated scripts first (fastest)
  - [ ] Run Tier 2 generated scrapers next
  - [ ] Hand remaining Tier 3 venues to Claude
  - [ ] Regenerate broken Tier 2 scrapers as needed
- [ ] UI polish: dark mode, mobile-friendly, animations
- [ ] Interest profile learning from attendance feedback

## Phase 5: Integration & Export

- [ ] Google Calendar OAuth (upgrade from deep links to direct push)
- [ ] Weekly digest generation (markdown or email)
- [ ] Export to iCal format
- [ ] Hailey mode (second interest profile for shared-interest events)
- [ ] Social layer possibilities (friends' calendars, shared output)

## Ongoing: Observability

- [ ] **Claude token tracking** — log token usage per agent run (input/output tokens, cost estimate) to `data/token_log.json`. Summary in `/scout status` so we can gauge cost per sweep and decide run frequency.
- [ ] **Event archive** — past events archived to `data/archive/YYYY-MM.json` for historical browsing. Never deleted, just moved out of the active set.

---

## Status

**Current phase:** Phase 3 tooling complete; first tier-routed full sweep DONE (2026-07-24: 127 staged from 32 venues; full audit applied to registry)
**Last updated:** 2026-07-24
**Next up:** `/scout review` to approve the staged events; `/scout aggregators` (Screen Slate run will also cover Spectacle + e-flux Screening Room, which block direct fetch). Blocked venues to solve later: MoMA/FLC/MoMI/Rhizome/McNally (403 even via WebFetch), The Shed (queue-it), New Museum/The Kitchen/Triple Canopy (JS-rendered), printed-matter/storefront/nyu-cns (network-level fail) — several are strong mailing-list-agent candidates (needs Gmail connector auth).

Notes:
- `/scout` slash command lives at `.claude/commands/scout.md` — subcommand playbooks for full/venue/category/aggregators/audit/discover/seasonal/review/add-venue/status, plus Tier 2 generation guidance.
- Tier routing in `/scout full`: Tier 1 → `fetch-eventbrite.ts`/`fetch-rss.ts`, Tier 2 → `run-scraper.ts` (falls back to Tier 3 on failure), Tier 3 → Claude WebFetch loop.
- Archive: 115 stale events from the March run moved to `data/archive/2026-{03..06}.json` on 2026-07-23.
