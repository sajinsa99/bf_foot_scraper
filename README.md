```markdown
# bf_foot_scraper
# bf_foot_scraper

Small Node.js scraper that fetches the Ligue 1 standings from Foot Mercato and
stores timestamped snapshots in a flat JSON DB at `data/standings.json`.

Quick start

1. Install dependencies:

```bash
cd bf_foot_scraper
npm install
```

2. Run the scraper (on demand):

```bash
npm run scrape
```

What it does
- Fetches `https://www.footmercato.net/france/ligue-1/classement`.
- Auto-detects the season string (e.g. `2025/2026`).
- Parses the standings into an array of club objects and writes a timestamped
	snapshot under the season key in `data/standings.json`.

Data schema (example)

```json
{
	"2025/2026": [
		{
			"date": "2025-12-06T18:36:24.838Z",
			"source": "https://www.footmercato.net/france/ligue-1/classement",
			"clubs": [
				{
					"position": 1,
					"name": "Lens",
					"points": 34,
					"played": 15,
					"goal_difference": 13,
					"wins": 11,
					"draws": 1,
					"losses": 3,
					"goals_for": 26,
					"goals_against": 13
				}
			]
		}
	]
}
```

Files of interest
- `scrape.js` — CLI entry point (writes snapshots).
- `lib/footmercato.js` — HTML parsing logic.
- `data/standings.json` — flat JSON DB (persist snapshots here).

Notes & recommendations
- `data/standings.json` is intended to persist historical snapshots. Keep it in the repo if you want history tracked by Git.
- The parser uses heuristics and a fallback; it worked for the current page format but may need tweaks if Foot Mercato changes layout.
- If you want automated updates, I can add a GitHub Action that runs the scraper on a schedule and commits the DB back to the repo.

Troubleshooting
- If scraping fails with network errors, check your network or try again later.
- If parsing returns empty `clubs`, inspect the raw HTML in a browser and adjust selectors in `lib/footmercato.js`.

Wrapper script: `get_data.sh`

For convenience a small shell wrapper `get_data.sh` is provided to call the scraper
for Transfermarkt rounds. It accepts `SEASON MAX [MIN]`. If `MIN` is omitted it
defaults to `MAX`.

Examples:

```bash
# scrape season 2025, rounds 1..14
./get_data.sh 2025 14 1

# scrape season 2025, round 14 only
./get_data.sh 2025 14
```

The wrapper uses `npm run scrape` when `npm` is available, otherwise falls back
to `node scrape.js`.

License: MIT
