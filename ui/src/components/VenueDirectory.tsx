import { useMemo } from "react";
import type { Event, Location } from "../types";

interface VenueDirectoryProps {
  locations: Location[];
  events: Event[];
}

export function VenueDirectory({ locations, events }: VenueDirectoryProps) {
  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of events) {
      counts.set(ev.venue_id, (counts.get(ev.venue_id) || 0) + 1);
    }
    return counts;
  }, [events]);

  const grouped = useMemo(() => {
    const map = new Map<string, Location[]>();
    for (const loc of locations) {
      if (loc.status === "inactive") continue;
      const hood = loc.neighborhood || "Other";
      const group = map.get(hood) || [];
      group.push(loc);
      map.set(hood, group);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [locations]);

  const tierLabel = (tier: number) => {
    if (tier === 1) return "Structured";
    if (tier === 2) return "Generated";
    return "Claude";
  };

  return (
    <div className="venue-directory">
      <div className="feed-header">
        <span className="event-count">{locations.filter(l => l.status !== "inactive").length} venues</span>
      </div>

      {[...grouped.entries()].map(([hood, locs]) => (
        <div key={hood} className="hood-group">
          <h2 className="day-header">{hood}</h2>
          <div className="venue-list">
            {locs.map((loc) => {
              const count = eventCounts.get(loc.id) || 0;
              const sourceUrl = loc.event_sources[0]?.url;

              return (
                <div key={loc.id} className="venue-card">
                  <div className="venue-header">
                    <h3 className="venue-name">
                      {loc.name}
                      {loc.entity_type === "org" && <span className="org-badge">org</span>}
                    </h3>
                    <span className="venue-score" title="Relevance score">
                      {loc.relevance_score}
                    </span>
                  </div>

                  <div className="venue-meta">
                    {loc.address && <span className="venue-address">{loc.address}</span>}
                    <span className="venue-tier">Tier {loc.scrape_tier} ({tierLabel(loc.scrape_tier)})</span>
                  </div>

                  <div className="venue-tags">
                    {loc.categories.map((cat) => (
                      <span key={cat} className="format-badge venue-cat">{cat}</span>
                    ))}
                  </div>

                  <div className="venue-stats">
                    <span>{count} upcoming event{count !== 1 ? "s" : ""}</span>
                    {loc.last_checked && (
                      <span>Checked {new Date(loc.last_checked).toLocaleDateString()}</span>
                    )}
                    {!loc.last_checked && <span className="not-checked">Not yet checked</span>}
                  </div>

                  {sourceUrl && (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                      View Source
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
