import { useState } from "react";
import type { Event, Location } from "../types";
import { buildGoogleCalendarUrl } from "../data";

interface EventCardProps {
  event: Event;
  location?: Location;
}

function ScoreDots({ score }: { score: number }) {
  return (
    <span className="row-score" title={`Score: ${score}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`score-dot ${i <= Math.round(score) ? "filled" : ""}`} />
      ))}
    </span>
  );
}

export function EventCard({ event, location }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const gcalUrl = buildGoogleCalendarUrl(event, location);

  const venue = event.venue_name || event.venue_id;
  const venueLine = location?.neighborhood ? `${venue} · ${location.neighborhood}` : venue;

  return (
    <div
      className={`event-row ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="row-line">
        <span className="row-time">{event.time_start ?? ""}</span>
        <span className="row-title">{event.title}</span>
        <span className="row-venue">{venueLine}</span>
        <span className="row-format">{event.format ?? ""}</span>
        <span className="row-price">{event.price ?? ""}</span>
        <ScoreDots score={event.interest_score} />
      </div>

      {expanded && (
        <div className="row-detail" onClick={(e) => e.stopPropagation()}>
          {event.description && (
            <p className="detail-description">{event.description}</p>
          )}
          {event.matched_categories.length > 0 && (
            <div className="detail-tags">
              {event.matched_categories.map((cat) => (
                <span key={cat} className="detail-tag">#{cat}</span>
              ))}
            </div>
          )}
          <div className="detail-actions">
            {event.url && (
              <a href={event.url} target="_blank" rel="noopener noreferrer" className="detail-link">
                view page
              </a>
            )}
            <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className="detail-link">
              + calendar
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
