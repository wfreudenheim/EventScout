import { loadLocations, saveLocations } from "../utils/data.js";
import type { Location } from "../types/index.js";

const newVenues: Location[] = [
  {
    id: "moma",
    name: "MoMA",
    entity_type: "venue",
    address: "11 W 53rd St, New York, NY 10019",
    neighborhood: "Midtown",
    categories: ["museum"],
    event_sources: [{ type: "website", url: "https://www.moma.org/calendar/" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.5, added_by: "manual", status: "active",
  },
  {
    id: "guggenheim",
    name: "Guggenheim",
    entity_type: "venue",
    address: "1071 5th Ave, New York, NY 10128",
    neighborhood: "Upper East Side",
    categories: ["museum"],
    event_sources: [{ type: "website", url: "https://www.guggenheim.org/calendar" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.0, added_by: "manual", status: "active",
  },
  {
    id: "cooper-union",
    name: "Cooper Union",
    entity_type: "venue",
    address: "7 E 7th St, New York, NY 10003",
    neighborhood: "East Village",
    categories: ["university", "talks"],
    event_sources: [{ type: "website", url: "https://cooper.edu/events" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.5, added_by: "manual", status: "active",
  },
  {
    id: "printed-matter",
    name: "Printed Matter",
    entity_type: "venue",
    address: "231 11th Ave, New York, NY 10001",
    neighborhood: "Chelsea",
    categories: ["bookstore", "community"],
    event_sources: [{ type: "website", url: "https://www.printedmatter.org/programs" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.5, added_by: "manual", status: "active",
  },
  {
    id: "the-shed",
    name: "The Shed",
    entity_type: "venue",
    address: "545 W 30th St, New York, NY 10001",
    neighborhood: "Hudson Yards",
    categories: ["performance", "gallery", "music"],
    event_sources: [{ type: "website", url: "https://theshed.org/program" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.0, added_by: "manual", status: "active",
  },
  {
    id: "performance-space-ny",
    name: "Performance Space New York",
    entity_type: "venue",
    address: "150 1st Ave, New York, NY 10009",
    neighborhood: "East Village",
    categories: ["performance"],
    event_sources: [{ type: "website", url: "https://performancespacenewyork.org/shows/" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 4.0, added_by: "manual", status: "active",
  },
  {
    id: "secret-science-club",
    name: "Secret Science Club",
    entity_type: "org",
    neighborhood: "Gowanus",
    categories: ["science", "talks"],
    event_sources: [{ type: "website", url: "https://www.secretscienceclub.com" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 4.0, added_by: "manual", status: "active",
  },
  {
    id: "storefront-art-arch",
    name: "Storefront for Art and Architecture",
    entity_type: "venue",
    address: "97 Kenmare St, New York, NY 10012",
    neighborhood: "LES",
    categories: ["architecture", "gallery"],
    event_sources: [{ type: "website", url: "https://storefrontnews.org/programming/" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 4.0, added_by: "manual", status: "active",
  },
  {
    id: "architectural-league",
    name: "Architectural League of New York",
    entity_type: "org",
    categories: ["architecture", "talks"],
    event_sources: [{ type: "website", url: "https://archleague.org/events/" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.5, added_by: "manual", status: "active",
  },
  {
    id: "mcnally-jackson",
    name: "McNally Jackson",
    entity_type: "venue",
    address: "52 Prince St, New York, NY 10012",
    neighborhood: "SoHo",
    categories: ["bookstore", "talks"],
    event_sources: [{ type: "website", url: "https://www.mcnallyjackson.com/events" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.0, added_by: "manual", status: "active",
  },
  {
    id: "housing-works",
    name: "Housing Works Bookstore",
    entity_type: "venue",
    address: "126 Crosby St, New York, NY 10012",
    neighborhood: "SoHo",
    categories: ["bookstore", "talks"],
    event_sources: [{ type: "website", url: "https://www.housingworks.org/events" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.0, added_by: "manual", status: "active",
  },
  {
    id: "verso-books",
    name: "Verso Books",
    entity_type: "org",
    categories: ["bookstore", "talks"],
    event_sources: [{ type: "eventbrite", url: "https://www.eventbrite.com/d/ny--new-york/verso-books/" }],
    scrape_tier: 1, structured_source: "https://www.eventbrite.com/d/ny--new-york/verso-books/",
    generated_scraper: null,
    relevance_score: 3.5, added_by: "manual", status: "active",
  },
  {
    id: "nyu-cns",
    name: "NYU Center for Neural Science",
    entity_type: "venue",
    address: "4 Washington Pl, New York, NY 10003",
    neighborhood: "Greenwich Village",
    categories: ["university", "science"],
    event_sources: [{ type: "website", url: "https://as.nyu.edu/departments/cns/events.html" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 4.5, added_by: "manual", status: "active",
  },
  {
    id: "columbia-science-society",
    name: "Columbia Center for Science and Society",
    entity_type: "venue",
    neighborhood: "Morningside Heights",
    categories: ["university", "science"],
    event_sources: [{ type: "website", url: "https://scienceandsociety.columbia.edu/events" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 4.0, added_by: "manual", status: "active",
  },
  {
    id: "genspace",
    name: "Genspace",
    entity_type: "venue",
    neighborhood: "Brooklyn",
    categories: ["science", "hackerspace", "community"],
    event_sources: [{ type: "website", url: "https://www.genspace.org/events" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 4.0, added_by: "manual", status: "active",
  },
  {
    id: "elsewhere",
    name: "Elsewhere",
    entity_type: "venue",
    address: "599 Johnson Ave, Brooklyn, NY 11237",
    neighborhood: "Bushwick",
    categories: ["music", "performance"],
    event_sources: [{ type: "website", url: "https://www.elsewherebrooklyn.com/events" }],
    scrape_tier: 3, structured_source: null, generated_scraper: null,
    relevance_score: 3.0, added_by: "manual", status: "active",
  },
];

async function main() {
  const existing = await loadLocations();
  let added = 0;
  for (const nv of newVenues) {
    if (existing.find((l) => l.id === nv.id)) {
      console.log(`SKIP (exists): ${nv.id}`);
    } else {
      existing.push(nv);
      console.log(`Added: ${nv.id} — ${nv.name}`);
      added++;
    }
  }
  await saveLocations(existing);
  console.log(`\nAdded ${added} venues. Total: ${existing.length}`);
}

main().catch(console.error);
