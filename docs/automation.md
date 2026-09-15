# Automation

Everything runs off the GitHub repo (`wfreudenheim/EventScout`, public). Four pieces, all times America/New_York (crons are UTC — they drift an hour after the November clock change):

| When | What | Where | Needs |
|---|---|---|---|
| Wed + Sun 1:30am | **Fetch inbox** — IMAP pull of new newsletters, converted to stripped text (`data/inbox/txt/`), committed | GitHub Action `inbox.yml` (`30 5 * * 0,3`) | `SCOUT_EMAIL`, `SCOUT_EMAIL_PASSWORD` secrets |
| Wed + Sun 2:00am | **Sweep** — Claude cloud routine runs `/scout full`: archives past events, parses the text newsletters, fetches venues by tier, scores, stages, rebuilds calendar + digest, commits and pushes | Claude Code routine (`0 6 * * 0,3`, Sonnet 5) | repo access only |
| On push to `main` | **Site** — builds `ui/` with Vite and deploys to GitHub Pages | GitHub Action `pages.yml` | — |
| Sun 8:30am | **Digest** — builds the week-ahead digest and emails it; commits `output/digest/` + the site copy | GitHub Action `digest.yml` (`30 12 * * 0`) | secrets above + `DIGEST_TO` |

Site: https://wfreudenheim.github.io/EventScout/ — the "This Week ↗" link opens the latest digest.

## Why it's split this way

Only the sweep needs Claude. Fetching mail, building the digest, and sending it are deterministic scripts, so they run on GitHub's free cron and the mail password never leaves GitHub Secrets. The cloud routine can't see the local `.env`, which is why the inbox Action pre-fetches newsletters as text 30 minutes before the sweep.

## What's committed vs. not

- Committed: `data/*.json` (events, staged, locations, agent log, inbox manifest), `data/inbox/txt/*.txt` (pending newsletters, tracking links stripped — pruned once processed), `output/`, `ui/`.
- Ignored: `.env`, `data/inbox/*.html` (raw mail with personal unsubscribe tokens), `data/tmp/`, `node_modules/`.

## Manual equivalents

```bash
npx tsx src/scripts/fetch-inbox.ts --limit 300 && npx tsx src/scripts/inbox-to-text.ts   # what inbox.yml does
/scout full                                                                              # what the routine does
npx tsx src/scripts/build-digest.ts && DIGEST_TO=you@example.com npx tsx src/scripts/send-digest.ts   # what digest.yml does
```

Any workflow can also be run on demand from the Actions tab (`workflow_dispatch`).

## Debugging

- Routine runs and logs: https://claude.ai/code/routines
- Action runs: https://github.com/wfreudenheim/EventScout/actions
- If the sweep pushed but the site didn't update, check that `pages.yml` ran (it only triggers on `ui/**`, `data/*.json`, `output/digest/**`).
- If the digest is stale, the Sunday sweep probably didn't finish by 8:30am — run the digest workflow manually or move its cron later.

## Adjusting

- Sweep days/time: update the routine at claude.ai/code/routines and shift `inbox.yml` to 30 minutes earlier.
- Digest recipient: `gh secret set DIGEST_TO --body "..."`.
- Digest floor: `build-digest.ts --min-score 3` (default) — change in `digest.yml`.
