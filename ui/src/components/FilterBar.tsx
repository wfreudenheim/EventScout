import { useState } from "react";
import type { Filters } from "../types";

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  formats: string[];
  categories: string[];
  neighborhoods: string[];
}

export function FilterBar({ filters, onChange, formats, categories, neighborhoods }: FilterBarProps) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const [showMore, setShowMore] = useState(false);
  const hiddenActive = filters.categories.length + filters.neighborhoods.length;

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <label>score</label>
          <div className="chip-group">
            {([0, 2, 3, 4, 5] as const).map((score) => (
              <button
                key={score}
                className={`chip ${filters.minScore === score ? "active" : ""}`}
                onClick={() => update({ minScore: score })}
              >
                {score === 0 ? "any" : `${score}+`}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>when</label>
          <div className="chip-group">
            {(["week", "2weeks", "month", "all"] as const).map((range) => (
              <button
                key={range}
                className={`chip ${filters.dateRange === range ? "active" : ""}`}
                onClick={() => update({ dateRange: range })}
              >
                {range === "week" ? "this week" : range === "2weeks" ? "2 weeks" : range === "month" ? "month" : "all"}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>cost</label>
          <div className="chip-group">
            {(["all", "free", "paid"] as const).map((cost) => (
              <button
                key={cost}
                className={`chip ${filters.cost === cost ? "active" : ""}`}
                onClick={() => update({ cost })}
              >
                {cost}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <label>format</label>
          <div className="chip-group">
            {formats.map((fmt) => (
              <button
                key={fmt}
                className={`chip ${filters.formats.includes(fmt) ? "active" : ""}`}
                onClick={() => {
                  const next = filters.formats.includes(fmt)
                    ? filters.formats.filter((f) => f !== fmt)
                    : [...filters.formats, fmt];
                  update({ formats: next });
                }}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="filter-row">
        <button className="filter-toggle" onClick={() => setShowMore(!showMore)}>
          {showMore ? "− less" : "+ category · neighborhood"}
          {!showMore && hiddenActive > 0 && (
            <span className="filter-toggle-count"> ({hiddenActive} active)</span>
          )}
        </button>
      </div>

      {showMore && (
        <div className="filter-row">
          <div className="filter-group">
            <label>category</label>
            <div className="chip-group">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`chip cat-chip ${filters.categories.includes(cat) ? "active" : ""}`}
                  onClick={() => {
                    const next = filters.categories.includes(cat)
                      ? filters.categories.filter((c) => c !== cat)
                      : [...filters.categories, cat];
                    update({ categories: next });
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showMore && neighborhoods.length > 0 && (
        <div className="filter-row">
          <div className="filter-group">
            <label>neighborhood</label>
            <div className="chip-group">
              {neighborhoods.map((hood) => (
                <button
                  key={hood}
                  className={`chip ${filters.neighborhoods.includes(hood) ? "active" : ""}`}
                  onClick={() => {
                    const next = filters.neighborhoods.includes(hood)
                      ? filters.neighborhoods.filter((n) => n !== hood)
                      : [...filters.neighborhoods, hood];
                    update({ neighborhoods: next });
                  }}
                >
                  {hood}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
