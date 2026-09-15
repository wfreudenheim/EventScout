# EventScout Design System

Are.na-inspired, adapted from the cookbook project's language. Reference this
for any EventScout page or output surface (web UI, HTML reports, subscribe
pages).

## Principles

1. **Text is the interface.** No icons where a word works, no color where
   weight works. Information density comes from typography and alignment, not
   boxes.
2. **One line per thing.** An event is a row, not a card. Detail lives behind
   a click (expand in place — never navigate away for a description).
3. **The accent is earned.** Sage green appears only on: active filter state,
   interactive hover, and the score. Everything else is grayscale.
4. **Borders are hairlines.** 1px `#E5E5E5`, darkening to `#D1D1D1` on hover.
   Radius 2px ("rounded-sm"). No shadows except a whisper on overlays.
5. **Counts in parens.** Are.na-style: `screening (34)`, `Ridgewood (6)`.
   Filters always show what they'd yield.
6. **Whitespace over chrome.** Group separation = space + a hairline, never a
   filled background band.

## Tokens (from cookbook `tailwind.config.js`)

```css
--bg:            #FCFCFC;   /* page — warm off-white */
--bg-raised:     #FEFEFE;   /* rows, inputs, expanded panels */
--text:          #2A2A2A;   /* primary — soft black, never #000 */
--text-2:        #4A4A4A;   /* secondary — meta, labels */
--text-3:        #9B9B9B;   /* tertiary — counts, timestamps, hints */
--accent:        #6B7F6A;   /* sage — active, hover, score */
--accent-2:      #8FA08E;   /* lighter sage — secondary hover */
--accent-wash:   rgba(107,127,106,0.08);  /* accent/10 fills */
--border:        #E5E5E5;
--border-hover:  #D1D1D1;
--good:          #A3B3A2;   /* success tint */
--warn:          #C4857A;   /* muted terracotta — errors, "not checked" */
```

Typography: system sans stack, antialiased. Sizes: 15px base, 13px meta,
11px labels/counts. Weights: 400 default, 500 for emphasis — never bold-700.
Section headers (dates, neighborhoods): 13px, uppercase, letter-spaced 0.05em,
`--text-2`.

## Component patterns

### Event row (the core unit)
Single grid line, click to expand:

```
19:30  Solaris preceded by The Working End   Metrograph · LES   screening   $18   ●●●●●
```

- Grid: `time(3.2rem) title(1fr) venue(auto) format(auto) price(auto) score(auto)`
- Title `--text` 500; venue `--text-2`; time/price/format `--text-3` 13px
- Score: five 5px dots, filled = `--accent`, empty = `--border`
- Hover: background `--bg-raised`, left 2px sage rule
- Expanded panel: description, category tags (text with `#` prefix, no pills),
  actions as underlined text links ("view page", "+ calendar") — no buttons
- Mobile: two-line stack (title line, meta line), same row model

### Day / group headers
Sticky-adjacent, quiet: `FRIDAY, JULY 24 (12)` — uppercase 13px, count in
parens `--text-3`. A hairline rule under, nothing more.

### Filters (cookbook TagFilter pattern)
Inline rows, not stacked panels:

```
score  2+ 3+ 4+ 5      when  week · 2 weeks · month · all      cost  all · free · paid
format  screening (34)  music (22)  talk (9) …
```

- Label: 11px uppercase `--text-3`, then chips inline
- Chip default: plain text `--text-2`, hover → sage text + `--accent-wash` bg
- Chip active: `--accent` bg, white text, 500 weight
- Counts update against *other* active filters (cookbook behavior)
- No sliders, no dropdowns, no selects — everything is a text chip
- Collapsible behind a "filter (n active)" toggle when vertical space matters

### Venue directory
Same row model: name · categories (text tags) · event count · tier ·
last-checked. `org` marker as bracketed text `[org]`. "Not yet checked" in
`--warn`. Grouped by neighborhood with the same header style.

### Header / nav
Borderless except bottom hairline. Wordmark left (plain text, hover sage),
views as text links right — active = sage, not a pill. Height ~56px.

## Anti-patterns (things the old UI did — don't reintroduce)

- Rainbow per-format badge colors → format is quiet text; if differentiation
  is ever needed, vary only the tag's border
- Filled pill tag clouds → text tags with `#` or parens
- Solid primary buttons in content rows → underlined text links
- Dark theme as default → light is the identity; dark can come later as an
  explicit toggle, same tokens inverted
- Score as a progress bar → dots

## Where this applies

- `ui/` web app (implemented 2026-07)
- Markdown/HTML outputs in `output/` (subscribe.html, future reports)
- Any future artifact pages
