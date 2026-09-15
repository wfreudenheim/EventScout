export interface Event {
  id: string;
  title: string;
  venue_id: string;
  venue_name?: string;
  date: string;
  time_start?: string;
  time_end?: string;
  description?: string;
  url?: string;
  price?: string;
  format?: string;
  interest_score: number;
  tags: string[];
  matched_categories: string[];
  source_agent: string;
  status: string;
  discovered_at: string;
}

export interface Location {
  id: string;
  name: string;
  entity_type: string;
  address?: string;
  neighborhood?: string;
  coordinates?: [number, number];
  categories: string[];
  event_sources: { type: string; url: string; notes?: string }[];
  scrape_notes?: string;
  scrape_tier: number;
  last_checked?: string;
  relevance_score: number;
  status: string;
}

export type ViewMode = "feed" | "venues" | "sources";

export interface Filters {
  minScore: number;
  formats: string[];
  categories: string[];
  neighborhoods: string[];
  cost: "all" | "free" | "paid";
  dateRange: "week" | "2weeks" | "month" | "all";
}
