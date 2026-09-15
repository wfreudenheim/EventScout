import { useState, useEffect } from "react";
import type { Event, Location, Filters, ViewMode } from "./types";
import { loadEvents, loadLocations, getFormats, getCategories, getNeighborhoods } from "./data";
import { FilterBar } from "./components/FilterBar";
import { EventFeed } from "./components/EventFeed";
import { VenueDirectory } from "./components/VenueDirectory";
import { SignupList } from "./components/SignupList";

const DEFAULT_FILTERS: Filters = {
  minScore: 2,
  formats: [],
  categories: [],
  neighborhoods: [],
  cost: "all",
  dateRange: "month",
};

export default function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("feed");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadEvents(), loadLocations()]).then(([ev, loc]) => {
      setEvents(ev);
      setLocations(loc);
      setLoading(false);
    });
  }, []);

  const formats = getFormats(events);
  const categories = getCategories(events);
  const neighborhoods = getNeighborhoods(locations);

  if (loading) {
    return <div className="loading">Loading events...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">NYC Event Scout</h1>
          <nav className="view-toggle">
            <button
              className={`tab ${view === "feed" ? "active" : ""}`}
              onClick={() => setView("feed")}
            >
              Events
            </button>
            <button
              className={`tab ${view === "venues" ? "active" : ""}`}
              onClick={() => setView("venues")}
            >
              Venues
            </button>
            <button

              className={`tab ${view === "sources" ? "active" : ""}`}

              onClick={() => setView("sources")}

            >

              Sources
            </button>
            <a className="tab tab-link" href={`${import.meta.env.BASE_URL}digest/latest.html`}>
              This Week ↗
            </a>
          </nav>
        </div>
      </header>

      {view === "feed" && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          formats={formats}
          categories={categories}
          neighborhoods={neighborhoods}
        />
      )}

      <main className="main-content">
        {view === "feed" ? (
          <EventFeed
            events={events}
            locations={locations}
            filters={filters}
            onShowAll={() => setFilters({ ...filters, dateRange: "all" })}
          />
        ) : view === "venues" ? (
          <VenueDirectory locations={locations} events={events} />
        ) : (
          <SignupList />
        )}
      </main>
    </div>
  );
}
