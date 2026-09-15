import { useMemo } from "react";
import type { Event, Location, Filters } from "../types";
import { EventCard } from "./EventCard";

interface EventFeedProps {
  events: Event[];
  locations: Location[];
  filters: Filters;
  onShowAll?: () => void;
}

export function EventFeed({ events, locations, filters, onShowAll }: EventFeedProps) {
  const locationMap = useMemo(() => {
    const map = new Map<string, Location>();
    for (const loc of locations) map.set(loc.id, loc);
    return map;
  }, [locations]);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let endStr = "9999-12-31";
    if (filters.dateRange === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      endStr = d.toISOString().split("T")[0];
    } else if (filters.dateRange === "2weeks") {
      const d = new Date(now);
      d.setDate(d.getDate() + 14);
      endStr = d.toISOString().split("T")[0];
    } else if (filters.dateRange === "month") {
      const d = new Date(now);
      d.setDate(d.getDate() + 30);
      endStr = d.toISOString().split("T")[0];
    }

    const matchesExceptDate = (ev: Event) => {
      if (ev.date < todayStr) return false;
      if (ev.interest_score < filters.minScore) return false;
      if (filters.formats.length > 0 && !filters.formats.includes(ev.format || "")) return false;
      if (filters.categories.length > 0 && !ev.matched_categories.some((c) => filters.categories.includes(c))) return false;
      if (filters.cost === "free" && ev.price && ev.price !== "free") return false;
      if (filters.cost === "paid" && (!ev.price || ev.price === "free")) return false;
      if (filters.neighborhoods.length > 0) {
        const loc = locationMap.get(ev.venue_id);
        if (!loc || !loc.neighborhood || !filters.neighborhoods.includes(loc.neighborhood)) return false;
      }
      return true;
    };

    const inRange = events
      .filter((ev) => matchesExceptDate(ev) && ev.date <= endStr)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return b.interest_score - a.interest_score;
      });
    const beyondRange = events.filter((ev) => matchesExceptDate(ev) && ev.date > endStr).length;
    return { inRange, beyondRange };
  }, [events, filters, locationMap]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of filtered.inRange) {
      const group = map.get(ev.date) || [];
      group.push(ev);
      map.set(ev.date, group);
    }
    return map;
  }, [filtered]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  return (
    <div className="event-feed">
      <div className="feed-header">
        <span className="event-count">
          {filtered.inRange.length} events
          {filtered.beyondRange > 0 && (
            <>
              {" · "}
              <button className="show-all-link" onClick={onShowAll}>
                {filtered.beyondRange} more beyond this date range →
              </button>
            </>
          )}
        </span>
      </div>

      {filtered.inRange.length === 0 ? (
        <div className="empty-state">
          No events match your filters. Try adjusting the score or date range.
        </div>
      ) : (
        [...grouped.entries()].map(([date, dayEvents]) => (
          <div key={date} className="day-group">
            <h2 className="day-header">
              {formatDate(date)}
              <span className="day-count">({dayEvents.length})</span>
            </h2>
            <div className="day-events">
              {dayEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} location={locationMap.get(ev.venue_id)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
