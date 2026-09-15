import type { InterestProfile, Event } from "../types/index.js";

export interface ScoringResult {
  score: number;
  matchedCategories: string[];
  tags: string[];
}

export function scoreEvent(
  title: string,
  description: string,
  profile: InterestProfile
): ScoringResult {
  const text = `${title} ${description}`.toLowerCase();
  const matchedCategories: string[] = [];
  const tags: string[] = [];
  let totalScore = 0;
  let matchCount = 0;

  for (const category of profile.categories) {
    let categoryHits = 0;

    for (const keyword of category.keywords) {
      if (matchesKeyword(text, keyword.toLowerCase())) {
        categoryHits++;
        const tag = keyword.toLowerCase().replace(/\s+/g, "-");
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }

    if (categoryHits > 0) {
      matchedCategories.push(category.name);
      // Score: base from priority position (higher priority = more points),
      // multiplied by weight, boosted by number of keyword hits
      const priorityBonus = Math.max(0, (15 - category.priority) / 14); // 1.0 for priority 1, ~0.07 for priority 14
      const hitBonus = Math.min(categoryHits / 3, 1); // caps at 3 hits
      totalScore += (1 + priorityBonus + hitBonus) * category.weight;
      matchCount++;
    }
  }

  // Normalize to 0-5 scale
  const normalizedScore = Math.min(5, matchCount > 0 ? totalScore / matchCount + matchCount * 0.3 : 0);
  const roundedScore = Math.round(normalizedScore * 10) / 10;

  return {
    score: roundedScore,
    matchedCategories,
    tags,
  };
}

export function inferFormat(
  title: string,
  description: string
): Event["format"] {
  const text = `${title} ${description}`.toLowerCase();

  const patterns: [Event["format"], string[]][] = [
    ["opening", ["opening reception", "opening night", "vernissage"]],
    ["screening", ["screening", "film", "cinema", "movie", "repertory"]],
    ["talk", ["lecture", "talk", "panel", "discussion", "conversation with", "symposium", "colloquium", "seminar"]],
    ["workshop", ["workshop", "masterclass", "class", "hands-on", "tutorial"]],
    ["performance", ["performance", "dance", "theater", "theatre", "concert", "recital"]],
    ["music", ["dj", "live music", "set", "sound", "noise", "electronic music", "synth"]],
    ["reading", ["reading", "book launch", "poetry", "author"]],
    ["tour", ["walking tour", "building tour", "open house", "studio visit"]],
    ["festival", ["festival", "fair", "biennial"]],
    ["gallery", ["exhibition", "exhibit", "show", "gallery", "on view"]],
  ];

  for (const [format, keywords] of patterns) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return format;
      }
    }
  }

  return "other";
}

/**
 * Match a keyword against text using word boundaries.
 * Multi-word keywords use simple includes (they're specific enough).
 * Single/short words use word-boundary regex to avoid false positives
 * (e.g. "AR" matching "Berenice", "play" matching "display").
 */
function matchesKeyword(text: string, keyword: string): boolean {
  // Multi-word phrases are specific enough for substring matching
  if (keyword.includes(" ")) {
    return text.includes(keyword);
  }
  // Short keywords (<=3 chars) need strict word boundaries
  // Longer single words also use boundaries to avoid partial matches
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}
