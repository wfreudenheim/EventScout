// === Location Registry Types ===

export type EntityType = "venue" | "org";

export type LocationCategory =
  | "museum"
  | "gallery"
  | "cinema"
  | "performance"
  | "music"
  | "university"
  | "studio"
  | "community"
  | "club"
  | "outdoor"
  | "bookstore"
  | "hackerspace"
  | "science"
  | "art-tech"
  | "architecture"
  | "talks";

export type ScrapeSourceType =
  | "website"
  | "eventbrite"
  | "luma"
  | "instagram"
  | "rss"
  | "substack"
  | "api";

export interface EventSource {
  type: ScrapeSourceType;
  url: string;
  notes?: string;
}

export type ScrapeTier = 1 | 2 | 3;

export interface Location {
  id: string;
  name: string;
  entity_type: EntityType;
  address?: string;
  neighborhood?: string;
  coordinates?: [number, number]; // [lat, lng]
  categories: LocationCategory[];
  event_sources: EventSource[];
  scrape_notes?: string;
  scrape_tier: ScrapeTier; // 1=structured API/RSS, 2=generated scraper, 3=Claude parsing
  structured_source?: string | null; // Tier 1: Eventbrite/Luma/RSS URL
  generated_scraper?: string | null; // Tier 2: path to generated scraper script
  last_checked?: string; // ISO datetime
  relevance_score: number;
  added_by: "manual" | "discovery-agent" | "aggregator";
  status: "active" | "pending" | "inactive";
}

// === Event Types ===

export type EventFormat =
  | "gallery"
  | "performance"
  | "talk"
  | "screening"
  | "workshop"
  | "opening"
  | "music"
  | "festival"
  | "fair"
  | "reading"
  | "tour"
  | "conference"
  | "walk"
  | "other";

export type EventStatus = "staged" | "approved" | "rejected" | "archived";

export interface Event {
  id: string;
  title: string;
  venue_id: string;
  venue_name?: string; // denormalized for display
  date: string; // YYYY-MM-DD
  time_start?: string; // HH:MM
  time_end?: string; // HH:MM
  description?: string;
  url?: string;
  price?: string; // "free" | "$15" | "varies" etc.
  format?: EventFormat;
  interest_score: number; // 0-5
  tags: string[];
  matched_categories: string[];
  source_agent: string;
  status: EventStatus;
  discovered_at: string; // ISO datetime
}

// === Interest Profile Types ===

export interface InterestCategory {
  name: string;
  priority: number; // lower = higher priority
  keywords: string[];
  weight: number; // 1.0 = normal, higher = boosted
}

export interface InterestProfile {
  categories: InterestCategory[];
  score_threshold_auto_approve: number;
  min_score_to_stage: number; // Events below this are dropped entirely (default 1)
  default_gui_min_score: number; // GUI defaults to showing events at or above this (default 2)
  max_events_per_venue: number; // Cap per venue per scrape — keeps top-scored, drops rest (default 12)
}

// === Agent Types ===

export type AgentType =
  | "venue-agent"
  | "aggregator-agent"
  | "discovery-agent"
  | "institution-discovery-agent"
  | "seasonal-agent";

export interface AgentRun {
  agent_type: AgentType;
  target_id: string; // location id or search term
  scrape_tier_used?: ScrapeTier;
  started_at: string;
  completed_at?: string;
  events_found: number;
  events_new: number;
  status: "running" | "completed" | "failed";
  error?: string;
}

// === Seasonal Events ===

export type SeasonalStatus =
  | "unannounced"
  | "dates_announced"
  | "program_announced"
  | "on_calendar";

export interface SeasonalEvent {
  id: string;
  name: string;
  typical_month: number; // 1-12
  description: string;
  source_urls: string[];
  lead_time_months: number;
  last_checked?: string;
  current_year_status: SeasonalStatus;
  current_year_dates?: string;
  notes?: string;
}
