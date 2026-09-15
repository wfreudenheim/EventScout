/**
 * Generates the WebFetch prompt for Tier 3 venue parsing.
 * This prompt is sent alongside the venue URL to extract structured event data.
 */

const INTEREST_SUMMARY = `Interests ranked by priority:
1. Experimental animation, video art, moving image, game engine cinema
2. Art & technology, generative art, creative coding, new media, interactive installation
3. Climate & environmental art, ecology, speculative futures
4. Philosophy, critical theory, media theory, cybernetics, posthumanism
5. Neuroscience, AI, cognitive science, brain-computer interfaces
6. Science & technology studies, history of science, philosophy of science
7. Contemporary art (general) — gallery openings, exhibitions, sculpture, photography
8. Film & cinema — repertory, experimental, horror, documentary, Southeast Asian cinema
9. Experimental music, electronic music, sound art, noise, modular synth
10. Games & interactive art, game design, VR/AR
11. Indonesian/Southeast Asian culture, language exchange
12. Worldbuilding, speculative design, design fiction
13. Architecture & urbanism — lectures, tours, adaptive reuse, public space
14. Hackerspaces & creative tech — makerspaces, DIY electronics, creative coding workshops

Cross-cutting boosts: theory talks and art/science events rank above pure-genre events of equal quality.
Author talks and readings with speculative-fiction / sci-fi writers score very high (4-5).`;

export function buildVenuePrompt(venueName: string): string {
  return `Extract ALL upcoming events from this page. For each event, return a JSON object with these fields:

- title: exact event name
- date: YYYY-MM-DD format
- time_start: HH:MM 24-hour format (if listed)
- time_end: HH:MM 24-hour format (if listed)
- description: 1-3 sentence description of the event
- url: full URL to the event detail page (if relative, prefix with the site's base URL)
- price: "free", "$15", "varies", etc. (if listed)
- format: one of "performance", "music", "talk", "screening", "workshop", "opening", "gallery", "reading", "festival", "tour", "conference", "walk", "other"
- interest_score: 0-5 relevance score based on the interest profile below
- matched_categories: array of category names from the interest profile that this event matches

IMPORTANT:
- Skip events that are clearly irrelevant: children's programs, private fundraisers, member-only galas, corporate events, birthday parties
- Score 0 = no relevance at all, 1 = tangentially related, 2 = somewhat relevant, 3 = relevant, 4 = very relevant, 5 = perfect match
- Be generous with scoring for events at ${venueName} — if the event is at this venue it likely has some baseline relevance

${INTEREST_SUMMARY}

Return ONLY a JSON array. No other text. Today is ${new Date().toISOString().split("T")[0]}.`;
}

export function buildAggregatorPrompt(): string {
  return `Extract ALL upcoming events from this community calendar/aggregator page. For each event, return a JSON object with:

- title: exact event name
- date: YYYY-MM-DD format
- time_start: HH:MM 24-hour format (if listed)
- time_end: HH:MM 24-hour format (if listed)
- description: 1-3 sentence description
- url: full URL to the event detail page
- price: "free", "$15", "varies", etc.
- venue_name: name of the venue/location where the event takes place
- format: one of "performance", "music", "talk", "screening", "workshop", "opening", "gallery", "reading", "festival", "tour", "conference", "walk", "other"
- interest_score: 0-5 relevance score based on the interest profile below
- matched_categories: array of matching category names

IMPORTANT:
- Skip events scoring 0 (completely irrelevant)
- Focus on events in the next 4-8 weeks

${INTEREST_SUMMARY}

Return ONLY a JSON array. No other text. Today is ${new Date().toISOString().split("T")[0]}.`;
}
