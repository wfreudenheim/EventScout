# Spec Update #1: Runtime Model, Commands & Cadence

## Runtime Model

Claude Code is the runtime. No separate CLI app or Python scraper scripts for the agent logic. Everything runs from within Claude Code using slash commands. Claude Code reads the location registry, visits venue/org event pages, parses events using its own understanding of the page content (no brittle per-site scrapers), scores them against the interest profile, and writes results to local JSON data files.

The web UI is separate — a simple local web app that reads the JSON data files and renders the browsable calendar. Doesn't need Claude Code running to work.

## Run Cadence

Manual, once or twice a month. Agents search next month + anything further out. Merges, deduplicates, archives past events.

## Scraping Strategy: Hybrid Tiered Approach

- **Tier 1**: Structured sources (Eventbrite API, RSS, Luma) — automated, no Claude needed
- **Tier 2**: Generated scrapers — Claude writes once, runs automatically after
- **Tier 3**: Claude-powered parsing — Claude reads HTML directly. Default for Phase 1.

Phase 1 starts pure Tier 3. Over time, Claude generates Tier 2 scripts and identifies Tier 1 sources. Goal: `/scout full` runs mostly automated (60-70% Tier 1/2) with Claude handling the rest.

## Location Schema Additions

```json
{
  "scrape_tier": 3,
  "structured_source": null,
  "generated_scraper": null
}
```

## Updated Phase Plan

- **Phase 1**: Foundation + Tier 3 parsing end-to-end
- **Phase 2**: Local web UI, filters, Google Calendar deep links, venue directory
- **Phase 3**: Aggregators, category sweeps, org agents, Tier 2 generation, Tier 1 identification
- **Phase 4**: Discovery, seasonal, venue health, full tiered orchestration
