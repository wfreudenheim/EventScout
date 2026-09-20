# Automation

Everything runs off the GitHub repo (`wfreudenheim/EventScout`, public). Five pieces, all times America/New_York (crons are UTC — they drift an hour after the November clock change):

| When | What | Where | Needs |
|---|---|---|---|
| Wed + Sun 2:30am | **Prefetch** — IMAP pull of new newsletters as stripped text (`data/inbox/txt/`), Tier 1 Eventbrite fetches (`data/prefetch/*-eb.json`, unscored), Tier 2 scrapers, and every Tier 3 venue page as stripped text (`data/prefetch/venues/*.txt` + `_report.json`); committed to `main` | GitHub Action `prefetch.yml` (`30 6 * * 0,3`) | `SCOUT_EMAIL`, `SCOUT_EMAIL_PASSWORD` secrets |
| Wed + Sun 3:00am | **Sweep** — Claude cloud routine runs `/scout full`: archives past events, parses the text newsletters, scores the Tier 1 prefetch, parses the pre-fetched Tier 3 venue text via subagents (WebFetch only as a fallback), rebuilds calendar + digest, and pushes a `claude/sweep-<date>` branch | Claude Code routine (`0 7 * * 0,3`, Sonnet 5) | Claude GitHub App on the repo; environment **Network access = Full** |
| On push to `claude/sweep-*` | **Merge sweep** — merges the routine's branch into `main` (sweep wins conflicts), deletes the branch | GitHub Action `merge-sweep.yml` | — |
| On push to `main` | **Site** — builds `ui/` with Vite and deploys to GitHub Pages | GitHub Action `pages.yml` | — |
| Wed + Sun 6:30am | **Digest** — builds the week-ahead digest and emails it; commits `output/digest/` + the site copy | GitHub Action `digest.yml` (`30 10 * * 0,3`) | secrets above + `DIGEST_TO` |

Site: https://wfreudenheim.github.io/EventScout/ — the "This Week ↗" link opens the latest digest.

## Two things the cloud routine cannot do (and how that's handled)

1. **It cannot push to `main`.** Routines may always push to `claude/*` branches, but a push to any other branch is rejected if that branch carries commits by another author — and `main` has commits from the `eventscout-bot` Actions identity. So the routine pushes `claude/sweep-<date>` and `merge-sweep.yml` folds it into `main`. The Claude GitHub App must also be installed on the repo (https://github.com/apps/claude → Configure → wfreudenheim → select EventScout → Save); without it every push fails with "Claude doesn't have GitHub access to wfreudenheim/EventScout".
2. **Its network is restricted by default.** Cloud environments default to *Trusted* network access (package registries + GitHub only), which blocks WebFetch to venue sites with `403` / `host_not_allowed`. Fix: claude.ai/code/routines → the routine → menu → **Edit** → the cloud icon under the Instructions box (shows the environment name, e.g. "Default") → hover the environment → settings icon → **Network access: Full** → **Save changes**. Applies from the next run. All fetching (newsletters, Tier 1, Tier 2, and Tier 3 venue pages) now happens in the Prefetch Action, which has unrestricted network, so the sweep works even with egress blocked. Full network access on the routine's environment is still nice-to-have: it lets the routine WebFetch venues the Action couldn't get (see `data/prefetch/venues/_report.json`).

## Why it's split this way

Only the sweep needs Claude. Fetching mail, building the digest, and sending it are deterministic scripts, so they run on GitHub's free cron and the mail password never leaves GitHub Secrets. The cloud routine can't see the local `.env`, which is why the inbox Action pre-fetches newsletters as text 30 minutes before the sweep.

## What's committed vs. not

- Committed: `data/*.json` (events, staged, locations, agent log, inbox manifest), `data/inbox/txt/*.txt` (pending newsletters, tracking links stripped — pruned once processed), `data/prefetch/` (latest Tier 1 JSON and Tier 3 venue text, ~1 MB, overwritten each run), `output/`, `ui/`.
- Ignored: `.env`, `data/inbox/*.html` (raw mail with personal unsubscribe tokens), `data/tmp/`, `node_modules/`.

## Manual equivalents

```bash
npx tsx src/scripts/fetch-inbox.ts --limit 300 && npx tsx src/scripts/inbox-to-text.ts   # what prefetch.yml does (plus fetch-eventbrite.ts per Tier 1 venue and run-scraper.ts --all)
/scout full                                                                              # what the routine does
npx tsx src/scripts/build-digest.ts && DIGEST_TO=you@example.com npx tsx src/scripts/send-digest.ts   # what digest.yml does
```

Any workflow can also be run on demand from the Actions tab (`workflow_dispatch`).

## Debugging

- Routine runs and logs: https://claude.ai/code/routines
- Action runs: https://github.com/wfreudenheim/EventScout/actions
- If the sweep pushed but the site didn't update, check that `merge-sweep.yml` merged the `claude/sweep-*` branch and then `pages.yml` ran (it only triggers on `ui/**`, `data/*.json`, `output/digest/**`).
- If the digest is stale, that morning's sweep probably didn't finish by 6:30am — run the digest workflow manually or move its cron later.

## Adjusting

- Sweep days/time: update the routine at claude.ai/code/routines and shift `prefetch.yml` to 30 minutes earlier.
- Digest recipient: `gh secret set DIGEST_TO --body "..."`.
- Digest floor: `build-digest.ts --min-score 3` (default) — change in `digest.yml`.
