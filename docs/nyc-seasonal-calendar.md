# NYC Event Scout: Seasonal & Annual Events Calendar

A separate layer from the weekly venue-scraping system. These are recurring events that happen once a year (or seasonally) and need to be anticipated in advance rather than discovered week-to-week. The system should surface these proactively, e.g. "Archtober is next month, here's what's been announced so far."

## How This Layer Works

Each entry has:
- **Typical month/season** (some shift year to year)
- **Lead time needed** (when to start checking for announcements, ticket sales, deadlines)
- **Source URL** for tracking announcements

The system should run a "seasonal check" agent monthly that:
1. Looks at what's coming in the next 2-3 months
2. Checks if dates/programs have been announced yet
3. Surfaces a "heads up" list at the start of each month
4. For application-based events (open calls, residencies, festivals with submission deadlines), flags deadlines specifically

---

## January

**Association of Performing Arts Professionals (APAP) Conference**
Multi-venue performance showcases across NYC during the conference week. Good for catching experimental performance, dance, and interdisciplinary work.
Lead time: December

## February

**Armory Week / satellite fairs early programming**
Some smaller fairs and events cluster around early March but announce in February.
Lead time: January

## March

**Armory Show** (Javits Center)
Major contemporary art fair. Large scale, commercial, but good for seeing what galleries are pushing.
Lead time: January (exhibitor lists), February (programming)

**NADA New York**
More emerging/artist-run galleries. Often more interesting programming and booths than the Armory itself.
Lead time: February

**Spring/Break Art Show**
Curator-driven, non-commercial alternative art fair. Often the most experimental of the March fair cluster.
Lead time: February

**Outsider Art Fair** (Metropolitan Pavilion, Chelsea)
Self-taught, art brut, outsider art. Annual.
Lead time: January

**Indie Memphis / Other touring film festivals**
Various indie film festivals tour screenings through NYC in winter/spring months.

## April

**Tribeca Film Festival**
Major film festival, multi-venue across Tribeca/downtown. Premieres, talks, immersive/interactive section.
Lead time: February (submissions), March (program announcement)

**taste of science NYC festival**
Annual April science communication festival, events at Caveat, Pete's Candy Store, QED, and other venues.
Lead time: March

**Sakura Matsuri / Cherry Blossom Festival** (Brooklyn Botanic Garden)
Cultural festival, Japanese arts and performance. Connects to Southeast Asian cultural interests broadly.
Lead time: March

## May

**Jane's Walk NYC** (first weekend in May)
Free citizen-led walking tours across all five boroughs, organized by Municipal Art Society. Architecture, urbanism, history, ecology, culture.
Lead time: April

**Frieze New York**
Major international art fair at The Shed. High profile but also has interesting talks, commissions, and programming.
Lead time: March (exhibitors), April (programming/talks)

**NYCxDesign** (design festival week)
Multi-venue design festival. Talks, exhibitions, studio visits, installations across the city.
Lead time: March/April

**Five Boro Bike Tour** (if relevant for urbanism/infrastructure angle)

**NEW INC Demo Days** (typically spring)
New Museum's incubator showcase. Art, tech, design startups.
Lead time: Varies, check NEW INC announcements

## June

**World Science Festival**
Brian Greene's multi-venue science festival. Panels, performances, interactive events across NYC.
Lead time: April (program announcement)

**Bushwick Open Studios** (typically early June)
Massive open studio weekend across Bushwick. Hundreds of artists open their doors. Good for discovering new spaces and people.
Lead time: May

**Governors Island season opens** (late May through October)
Seasonal arts programming, public art installations, events.
Lead time: May

**Pride Month events**
Various arts/culture programming tied to Pride across institutions.

## July

**SummerStage** (Central Park + parks across boroughs, runs June through October)
Free concerts and performances. Spans genres.
Lead time: May (lineup announcements)

**Shakespeare in the Park** (Delacorte Theater, Central Park)
Free outdoor productions. Runs summer months.
Lead time: May/June

**NYC Neuromodulation Conference** (late July/early August, CCNY)
Academic but relevant for neuroscience/brain-computer interface interests.
Lead time: Spring (registration)

## August

**Cognitive Computational Neuroscience (CCN)** (at NYU, August 2026)
Annual forum bridging cognitive science, neuroscience, and AI.
Lead time: Spring (submissions), July (registration)

## September

**New York Film Festival** (Lincoln Center, late September into October)
Major film festival. Premieres, retrospectives, experimental sidebar programs.
Lead time: July (program announcement)

**Climate Week NYC**
Multi-venue events across the city tied to UN General Assembly. Environmental art, policy, activism.
Lead time: July/August

**Brooklyn Book Festival**
Free literary festival. Readings, panels, bookfair.
Lead time: August

**Photoville** (Brooklyn Bridge Park)
Free outdoor photography festival with shipping container galleries.
Lead time: August

## October

**Archtober** (month-long)
NYC's architecture and design month. Building of the Day tours, exhibitions, lectures, walking tours across the city. Centered at Center for Architecture.
Lead time: September (full schedule)

**Open House New York Weekend** (mid-October)
Behind-the-scenes access to buildings, infrastructure, studios, private spaces across all five boroughs. One of the best NYC events.
Lead time: September (site list announcement)

**Brooklyn Horror Film Festival**
Genre film festival. Screenings, panels, parties.
Lead time: August/September

**Comic Con** (Javits Center, if relevant)

**Printed Matter's NY Art Book Fair** (typically October)
Artists' books, zines, independent publishers. At MoMA PS1 or similar large venue.
Lead time: September

## November

**Performa** (biennial, next edition TBD)
Performance art biennial. Multi-venue, multi-week. Commissions, exhibitions, performances across the city.
Lead time: September/October

**DOC NYC** (documentary film festival)
Largest documentary festival in the US. Screenings across multiple venues.
Lead time: October

**Rhizome's Seven on Seven** (timing varies, often fall)
Pairs artists with technologists for one-day collaborations. At New Museum.
Lead time: Check Rhizome announcements

**Eyebeam open studios / showcases** (timing varies)

## December

**Pioneer Works end-of-year programming**
Often special events, benefit concerts, etc.

**Year-end gallery shows and closings**
Many galleries do group shows or final exhibitions before holiday break.

---

## Ongoing / Multi-Season

**First Thursdays** (various Chelsea galleries)
Monthly openings, particularly concentrated in Chelsea.

**Pioneer Works Second Sundays** (monthly, year-round)
Free open hours with art, music, science programming.

**Gallery opening seasons**
- **September**: Fall season openings (biggest wave)
- **January/February**: Winter/spring season openings
- **May**: Pre-summer openings

**Museum exhibition cycles**
Major museums (MoMA, Whitney, New Museum, Guggenheim) announce seasonal programming months in advance. Worth a quarterly check of upcoming exhibitions calendars.

**University semester events**
Academic talks, colloquia, and public lectures follow the semester calendar:
- **September - December**: Fall semester
- **January/February - May**: Spring semester
- Summer: Lighter programming, occasional workshops/intensives

---

## System Implementation Notes

This calendar should be stored as a separate data file (`seasonal_events.json`) with:
- Event name, typical month, description
- Source URLs for tracking
- Lead time (months before)
- Last checked date
- Status for current year: `unannounced` / `dates_announced` / `program_announced` / `on_calendar`

The **seasonal check agent** runs monthly (or on demand) and:
1. Looks ahead 2-3 months in the seasonal calendar
2. Visits source URLs to check for announcements
3. Updates status fields
4. Generates a "Coming Up" summary
5. Pushes confirmed events to the main events database

This separates the two rhythms cleanly: the weekly agents handle the ongoing venue scraping, while the seasonal agent handles the annual anticipation layer.
