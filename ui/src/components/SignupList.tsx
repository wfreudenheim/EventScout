import { useEffect, useState } from "react";

interface SignupVenue {
  id: string;
  name: string;
  problem: string;
  site: string;
  signup: string;
  notes?: string;
}

interface SignupGroup {
  title: string;
  venues: SignupVenue[];
}

interface SignupList {
  generated_at: string;
  note: string;
  groups: SignupGroup[];
}

const STORAGE_KEY = "scout-signups-done";

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDone(done: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch {
    // ignore — per-browser convenience only
  }
}

export function SignupList() {
  const [data, setData] = useState<SignupList | null>(null);
  const [done, setDone] = useState<Set<string>>(loadDone);
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data/signup_list.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, []);

  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    saveDone(next);
  };

  if (!data) return <div className="loading">Loading sources...</div>;

  const total = data.groups.reduce((n, g) => n + g.venues.length, 0);

  return (
    <div className="venue-directory signup-list">
      <div className="feed-header signup-header">
        <span className="event-count">
          {total} venues need a mailing-list signup · {done.size} done · list generated {data.generated_at}
        </span>
        <label className="signup-hide-done">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          hide done
        </label>
      </div>
      <p className="signup-note">{data.note}</p>

      {data.groups.map((group) => {
        const venues = hideDone ? group.venues.filter((v) => !done.has(v.id)) : group.venues;
        if (venues.length === 0) return null;
        return (
          <div key={group.title} className="hood-group">
            <h2 className="day-header">
              {group.title}
              <span className="day-count">{venues.length}</span>
            </h2>
            <div className="venue-list">
              {venues.map((v) => {
                const isDone = done.has(v.id);
                return (
                  <div key={v.id} className={`venue-card signup-card ${isDone ? "signup-done" : ""}`}>
                    <div className="venue-header">
                      <h3 className="venue-name">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => toggle(v.id)}
                          title="Mark as signed up"
                        />
                        {v.name}
                      </h3>
                      <span className="signup-problem">{v.problem}</span>
                    </div>
                    <div className="venue-meta">
                      <a href={v.signup} target="_blank" rel="noopener noreferrer" className="signup-link">
                        Sign up →
                      </a>
                      <a href={v.site} target="_blank" rel="noopener noreferrer">
                        site
                      </a>
                    </div>
                    {v.notes && <div className="signup-notes">{v.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
