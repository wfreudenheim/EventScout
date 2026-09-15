# NYC Event Scout
### A personal event discovery and calendar system, built with Claude Code

## Overview

A CLI-driven system that dispatches agents to scrape, aggregate, and categorize NYC cultural events from a curated set of sources, then populates two simple interfaces: a weekly calendar view and a browsable database of venues/locations. The system learns your taste profile and surfaces what matters, filtering out the noise.

Runs locally via Claude Code. Agents go out, do their research, and write results into local data files that feed the two views.

---

## Core Concepts

### 1. The Location Registry
A growing JSON/SQLite database of NYC venues and cultural spaces that the system knows about. Each entry includes:

- Name, address, neighborhood, coordinates
- Category tags (gallery, museum, cinema, performance space, university, studio, community space, club, outdoor)
- **Entity type**: `venue` (fixed location) or `org` (nomadic organization that hosts events at various venues)
- Event source URLs (where that venue/org publishes events: their website, Eventbrite page, Instagram, newsletter signup, Substack, etc.)
- Scrape strategy notes (RSS? Eventbrite API? HTML scrape? Substack? Manual?)
- Last checked date
- Relevance score (how often events here match your interests)

**Venue vs. Org distinction:** Some entries are physical venues with a fixed address (Pioneer Works, Metrograph). Others are organizations that produce events at varying locations (Do Not Research, Triple Canopy, DIS, Creative Time, n+1). The system tracks both, but handles them differently: venue agents check a known calendar page, while org agents track the organization's event announcements and extract the host venue from each event. When an org-sourced event takes place at a venue already in the registry, the system links them. When it takes place somewhere new, it flags the venue as a discovery candidate.

**Seed list to start with (based on your world):**

Galleries & Museums: MoMA, MoMA PS1, New Museum, Whitney, Guggenheim, The Drawing Center, James Cohan, Hauser & Wirth (all locations), Pace, Lisson, Gladstone, 303 Gallery, Miguel Abreu, Petzel, Canyon, e-flux, Artists Space, SculptureCenter, ISCP, Pioneer Works, Knockdown Center, The Kitchen

Film & Media: Metrograph, Film Forum, BAM, Anthology Film Archives, Museum of the Moving Image, IFC Center, Film at Lincoln Center, Spectacle Theater, UnionDocs, Light Industry, Maysles Documentary Center

Performance & Music: National Sawdust, Issue Project Room, Roulette, The Stone (New School), JACK, Café Oto (when touring NYC), Baby's All Right

Tech/Research/Talks: NYU ITP, The New School (Parsons, Media Studies), Columbia GSAPP, MIT Media Lab NYC events, Rhizome (at New Museum), Gray Area NYC, NEW INC, Eyebeam

Community Calendars (aggregators to also scrape): cal.red (Red Calendar), NYC Noise, performanceart_nyc, Protest One, Technoqueers

Other: Eventbrite (filtered), Luma (filtered), are.na event channels

### 2. The Interest Profile
A config file that defines your taste categories with weighted keywords. Used by agents to score and tag events.

**Categories (ranked by priority):**

1. **Experimental Animation & Moving Image** — animation, experimental film, video art, motion graphics, game engine cinema, machinima, real-time rendering, Blender, Unreal
2. **Art & Technology** — generative art, creative coding, AI art, new media, computational art, interactive installation, bioart, systems art, net art
3. **Climate & Environment** — climate fiction, environmental art, ecology, speculative futures, solarpunk, infrastructure, water, landscape
4. **Philosophy & Critical Theory** — philosophy of technology, continental philosophy, posthumanism, cybernetics, distributed cognition, media theory, reading groups
5. **Neuroscience, AI & Cognitive Science** — neuroscience lectures, computational neuroscience, artificial intelligence, machine learning, brain-computer interfaces, cognitive science, neural networks, perception, consciousness
6. **Science & Technology Studies / History of Science** — STS, history of science, history of technology, philosophy of science, sociology of knowledge, science policy, bioethics, material culture
7. **Contemporary Art (general)** — gallery openings, museum exhibitions, sculpture, painting, photography, curatorial projects
8. **Film & Cinema** — repertory screenings, film festivals, director Q&As, documentary, horror, experimental cinema, Southeast Asian cinema
9. **Sound & Music** — experimental music, electronic music, sound art, noise, ambient, live coding, modular synth
10. **Games & Interactive** — game design talks, interactive art, play, game studies, indie games
11. **Language & Culture** — Indonesian culture, Southeast Asian events, language exchange, translation
12. **Worldbuilding & Speculative Design** — speculative architecture, design fiction, scenario planning, future studies
13. **Architecture & Urbanism** — architecture lectures, urban design, urban planning, infrastructure, public space, preservation, housing, adaptive reuse, landscape architecture
14. **Hackerspaces & Creative Tech** — makerspaces, hardware hacking, creative coding workshops, open source tools, synthesizers, DIY electronics, pen plotters, fabrication

### 3. The Agents

Each agent is a Claude Code sub-task that:
- Takes a venue or source URL
- Scrapes or fetches upcoming events for the next 7-14 days
- Extracts: event name, date/time, location, description, URL, price/free
- Scores each event against the Interest Profile
- Tags with relevant categories
- Writes results to a staging file for review

**Agent types:**

- **Venue Agent** — checks a specific venue's website/calendar page
- **Aggregator Agent** — scrapes a community calendar like cal.red or Eventbrite filtered results
- **Discovery Agent** — given a neighborhood or theme, searches for new venues or event series not yet in the registry. Can find new spaces to add to the Location Registry over time.
- **Institution Discovery Agent** — runs less frequently (monthly or bi-weekly). Searches Eventbrite, Luma, Google, and community calendars for events matching the Interest Profile, then extracts the hosting venues. If a venue isn't already in the Location Registry, it flags it as a candidate for addition. This inverts the usual flow: instead of "check known venues for events," it's "find interesting events and work backwards to discover new venues." Good for surfacing pop-up series, university departments with public programming, new project spaces, etc.

### 4. The Interface

A locally-served web UI (lightweight: single HTML file + embedded JS/CSS, or a small Vite/React app) that Claude Code generates and serves via a simple local dev server.

**Main View: Event Feed**

Clean, minimal card layout. Each event card shows:
- Event title (clickable, opens source page in new tab)
- Date + time
- Venue name + neighborhood
- Format badge: `Gallery` `Performance` `Talk` `Screening` `Workshop` `Opening` `Music` `Other`
- Interest category pills (color-coded): e.g. `Art & Tech` `Climate` `Philosophy`
- Price tag: `Free` or `$15` etc.
- Interest score as a subtle indicator (filled dots, small bar, or similar)
- **"Add to Calendar" button** that pushes directly to a designated Google Calendar (e.g. "NYC Events") via the Google Calendar API or a gcal:// deep link
- **"View Page" button** that opens the original event URL

Cards are grouped by day with clear date headers. Default view is the next 7 days.

**Filter Bar (persistent, top of page):**
- **Format**: multi-select toggle chips for Gallery / Performance / Talk / Screening / Workshop / Music / Opening / Other
- **Interest Category**: multi-select for the 10 interest categories from the profile
- **Cost**: toggle for Free / Paid / All
- **Neighborhood**: dropdown or chips (Ridgewood, Bushwick, Williamsburg, LES, SoHo, Chelsea, Red Hook, etc.)
- **Minimum interest score**: simple slider or threshold selector
- **Date range**: this week / next 2 weeks / custom

Filters should feel instant (client-side filtering over the local JSON data).

**Secondary View: Venue Directory**
Browsable list/grid of all tracked venues:
- Name, neighborhood, category tags
- Number of upcoming events found
- Last checked date
- Link to their event source
- Relevance score over time
- New venues discovered by Discovery Agents appear with a "NEW" flag
- Click through to see all events from that venue

**Google Calendar Integration:**
- On first setup, authenticate with Google Calendar API (OAuth, stored locally)
- User specifies which calendar to push to (e.g. a calendar named "NYC Events")
- "Add to Calendar" on each event card creates a gcal event with: title, start/end time, location (venue name + address), description (event description + source URL)
- If OAuth feels too heavy for v1, fall back to generating Google Calendar deep links (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`) that open in browser with fields pre-filled. User just clicks "Save."

---

## System Architecture

```
┌─────────────────────────────────────────────┐
│              Claude Code CLI                 │
│                                              │
│   Commands:                                  │
│   > scout run          (run all agents)      │
│   > scout run --venue "Pioneer Works"        │
│   > scout discover --neighborhood "Bushwick" │
│   > scout calendar     (generate week view)  │
│   > scout locations    (browse registry)     │
│   > scout add-venue    (manually add)        │
│   > scout review       (approve staged)      │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │   Agent Dispatcher   │
    │                      │
    │  Spawns sub-agents   │
    │  per venue/source    │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   Local Data Store   │
    │                      │
    │  /data               │
    │    locations.json     │
    │    events.json        │
    │    interest_profile.  │
    │    staged_events.json │
    │    agent_log.json     │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   Local Web UI       │
    │   (localhost:3000)   │
    │                      │
    │  Event feed + filters│
    │  Venue directory     │
    │  → View source page  │
    │  → Add to GCal       │
    └─────────────────────┘
```

---

## Data Schema (Draft)

### Location
```json
{
  "id": "pioneer-works",
  "name": "Pioneer Works",
  "address": "159 Pioneer St, Brooklyn, NY 11231",
  "neighborhood": "Red Hook",
  "coordinates": [40.6784, -74.0132],
  "categories": ["art", "music", "talks", "community"],
  "event_sources": [
    {"type": "website", "url": "https://pioneerworks.org/events"},
    {"type": "eventbrite", "url": "..."}
  ],
  "scrape_notes": "Clean HTML calendar page, easy to parse",
  "last_checked": "2026-03-25T14:00:00Z",
  "relevance_score": 4.2,
  "added_by": "manual"
}
```

### Event
```json
{
  "id": "pw-2026-03-28-opening",
  "title": "Spring Exhibition Opening",
  "venue_id": "pioneer-works",
  "date": "2026-03-28",
  "time_start": "18:00",
  "time_end": "21:00",
  "description": "...",
  "url": "https://pioneerworks.org/events/...",
  "price": "free",
  "interest_score": 4,
  "tags": ["contemporary-art", "art-technology", "opening"],
  "matched_categories": ["Contemporary Art", "Art & Technology"],
  "source_agent": "venue-agent",
  "status": "approved",
  "discovered_at": "2026-03-25T14:30:00Z"
}
```

---

## Workflow

### Weekly Routine
1. **Monday morning**: Run `scout run` to dispatch all agents across the registry
2. **Agents scrape**: Each venue/aggregator agent fetches upcoming events for the next 7-14 days
3. **Scoring**: Events auto-scored against the Interest Profile
4. **Staging**: Results land in `staged_events.json`
5. **Review**: Run `scout review` to quickly approve/reject/edit staged events (or auto-approve anything above a score threshold)
6. **Calendar generation**: Run `scout calendar` to produce the week view

### Ongoing
- Run `scout discover --neighborhood "Ridgewood"` periodically to find new venues
- Manually add venues as you hear about them via `scout add-venue`
- Aggregator agents (cal.red, etc.) naturally surface events from unlisted venues, which can be added to the registry

---

## Growth Patterns

- **Interest Profile tuning**: Over time, adjust weights based on which events you actually attend vs. skip
- **Venue health tracking**: Flag venues that haven't had events in a while, or whose pages changed structure (broken scrapes)
- **Social layer**: Eventually could cross-reference with friends' calendars or share the weekly output
- **Hailey mode**: A second interest profile for date-night or shared-interest events
- **Export**: Push approved events to Google Calendar, iCal, or Notion
- **Newsletter**: Auto-generate a weekly email digest from the calendar output

---

## Technical Considerations

- **Scraping**: Most venue sites are static HTML, parseable with basic fetch + DOM parsing. cal.red is notably anti-big-tech and may need respectful scraping (or manual entry). Eventbrite has an API. Instagram is harder (may need to track via their website embeds or skip).
- **Rate limiting**: Agents should space requests and cache aggressively. Don't hammer small venues.
- **Deduplication**: Events may appear on both a venue's site and an aggregator. Dedupe by title + date + venue.
- **Staleness**: Events data goes stale fast. The system should always prefer fresh scrapes over cached data for the current week.
- **Storage**: Start with JSON files. Move to SQLite if the dataset grows or you want better querying.

---

## Phase Plan

**Phase 1: Foundation**
- Set up project structure and data schemas
- Build the Location Registry with 20-30 seed venues (manually entered)
- Build the Interest Profile config
- Build one Venue Agent that can scrape a simple HTML calendar page
- Generate a basic Markdown weekly calendar

**Phase 2: Interface & Interactions**
- Build the local web UI with event feed and filter bar
- Implement client-side filtering (format, category, cost, neighborhood, score)
- Add Google Calendar deep links ("Add to Calendar" button per event)
- Add "View Page" button linking to source URL
- Build the Venue Directory secondary view
- Build the staging/review workflow (could be a tab in the UI or stay CLI-based)

**Phase 3: Agent Expansion**
- Build the Aggregator Agent for cal.red
- Build Eventbrite API integration
- Add scoring and tagging pipeline
- Add deduplication logic

**Phase 4: Discovery & Polish**
- Build the Discovery Agent
- Add venue health tracking
- Refine UI (animations, mobile-friendly, dark mode)
- Interest Profile learning from attendance feedback

**Phase 5: Integration**
- Google Calendar OAuth (upgrade from deep links to direct push)
- Weekly digest generation (email or markdown)
- Export to other formats if needed
