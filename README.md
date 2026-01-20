# bf_foot_scraper

Node.js scraper that fetches Ligue 1 standings from Transfermarkt and stores 
timestamped snapshots in a flat JSON DB at `data/seasons.json`.

## Quick start

1. Install dependencies:

```bash
cd bf_foot_scraper
npm install
```

2. Fetch data using the wrapper scripts (see below).

## What it does

- Fetches standings data from Transfermarkt for specified rounds/seasons
- Auto-detects the maximum available round for a season
- Auto-detects the latest available season from Transfermarkt
- Parses standings into club objects with position, points, goals, etc.
- Stores timestamped snapshots in `data/seasons.json` organized by season
- Supports both single-season and multi-season fetching

## Data schema (example)

```json
{
  "2025/2026": [
    {
      "date": "2026-01-19T21:00:00.000Z",
      "source": "transfermarkt",
      "url": "https://www.transfermarkt.fr/ligue-1/spieltagtabelle/...",
      "season": "2025",
      "round": 17,
      "snapshot_type": "round_standings",
      "clubs": [
        {
          "position": 1,
          "name": "RC Lens",
          "played": 17,
          "goal_difference": 13,
          "points": 42,
          "goals_for": 40,
          "goals_against": 27,
          "wins": 13,
          "draws": 3,
          "losses": 1
        }
      ]
    }
  ]
}
```

## Files of interest

- `scrape.js` — CLI entry point (fetches and writes snapshots)
- `lib/parsers/transfermarkt.js` — Transfermarkt HTML parsing & auto-detection
- `lib/parsers/footmercato.js` — Footmercato HTML parsing (legacy)
- `data/seasons.json` — Flat JSON DB (persistent historical data)
- `get_one_season.sh` — Fetch/manage single season data
- `get_all_seasons.sh` — Fetch multiple seasons in batch

## Shell Wrappers

### `get_one_season.sh` — Single season management

Fetch, delete, or check status of data for one season at a time.

**Usage:**
```bash
./get_one_season.sh [-s=SEASON] [-j=JOURNEY] -a=ACTION [-min=MIN] [-max=MAX]
```

**Actions:**
- `fetch` — Fetch specific rounds or range
- `fetch-all` — Fetch all available rounds (auto-detects max)
- `fetch-last` — Fetch only the latest available round (auto-detects max)
- `delete` — Delete season or specific rounds
- `status` — Check available seasons/rounds

**Season parameter behavior:**
- For `fetch`, `fetch-all`, `fetch-last`, `delete`: `-s=latest` auto-detects from **Transfermarkt** (current source)
- For `status`: `-s=latest` gets latest season from **local JSON database**

**Examples:**

```bash
# Check latest season in your local database
./get_one_season.sh -s=latest -a=status

# Fetch all available rounds for latest season from Transfermarkt
./get_one_season.sh -s=latest -a=fetch-all

# Fetch latest round of the latest season from Transfermarkt
./get_one_season.sh -s=latest -a=fetch-last

# Fetch all available rounds for season (auto-detects max)
./get_one_season.sh -s=2025 -a=fetch-all

# Fetch only the latest available round
./get_one_season.sh -s=2025 -a=fetch-last

# Fetch specific round range
./get_one_season.sh -s=2025 -min=1 -max=17 -a=fetch

# Fetch only round 17 (replaces if it already exists)
./get_one_season.sh -s=2025 -j=17 -a=fetch

# Fetch multiple specific rounds
./get_one_season.sh -s=2025 -j=13,15,17 -a=fetch

# Check available journeys for a season
./get_one_season.sh -s=2025 -a=status

# Check if specific journey exists
./get_one_season.sh -s=2025 -j=17 -a=status

# Delete entire season
./get_one_season.sh -s=2025 -a=delete

# Delete specific round(s)
./get_one_season.sh -s=2025 -j=13 -a=delete
```

**Flags:**
- `-s=SEASON` — Season (YYYY, YYYY/YYYY format, or 'latest'; e.g., `-s=2025`, `-s=2025/2026`, `-s=latest`)
- `-j=JOURNEY` — Specific round(s): single (`-j=5`) or multiple (`-j=13,15,17`)
- `-min=MIN` — Minimum round for range (default: 1)
- `-max=MAX` — Maximum round for range (default: 38)
- `-a=ACTION` — Action: `fetch`, `fetch-all`, `fetch-last`, `delete`, or `status`

### `get_all_seasons.sh` — Batch multi-season management

Fetch all rounds for multiple seasons in one command, or display status of all seasons.

**Usage:**
```bash
./get_all_seasons.sh [-os=OLDEST_SEASON -ns=NEWEST_SEASON] [-status] [-h|--help]
```

**Actions:**
- **Fetch mode**: Fetch all rounds for multiple seasons (requires BOTH `-os` and `-ns`)
- **Status mode** (`-status`): Display all available seasons and their rounds

**Important:** Fetch mode requires BOTH `-os=OLDEST_SEASON` and `-ns=NEWEST_SEASON`. If one is missing, the script will exit with an error message. Before clearing data, you'll be asked to confirm with `yes`.

**Examples:**

```bash
# Fetch latest season with all available rounds (auto-detects latest)
./get_all_seasons.sh -os=2020 -ns=latest

# Fetch seasons 2020 through 2025 (asks for confirmation before clearing data)
./get_all_seasons.sh -os=2020 -ns=2025

# Fetch seasons 2019/2020 through 2025/2026 (asks for confirmation)
./get_all_seasons.sh -os=2019/2020 -ns=2025/2026

# Show all available seasons and their round counts (newest to oldest)
./get_all_seasons.sh -status

# Show all seasons and retry missing journeys
./get_all_seasons.sh -status -retry-missing

# Show help
./get_all_seasons.sh -h
```

**Fetch Mode Behavior:**
1. Validates that BOTH `-os` and `-ns` are specified (error if only one provided)
2. Shows warning message and asks for confirmation (type `yes` to proceed)
3. Clears `data/seasons.json` completely
4. Loops through years from oldest to newest
5. For each season, runs `./get_one_season.sh -s=$year -a=fetch-all`
6. Includes 1-second delay between seasons (prevents timeouts)
7. Shows status after each season completes
6. Displays final summary of all available seasons/rounds

**Status Mode Behavior:**
1. Reads all available seasons from `data/seasons.json`
2. Sorts seasons from newest to oldest
3. For each season, displays available rounds (min to max)
4. Highlights any missing rounds in the range
5. Useful for monitoring data completeness

**Flags:**
- `-os=SEASON` — Oldest season to fetch (required for fetch mode, use `latest` or YYYY format)
- `-ns=SEASON` — Newest season to fetch (required for fetch mode, use `latest` or YYYY format)
- `-status` — Show all available seasons and rounds (status mode)
- `-retry-missing` — Retry fetching missing journeys (use with `-status`)

## Features & Best Practices

### Core Features
- **Auto-detect latest season**: Use `-s=latest` or `-ns=latest` to fetch the current season automatically
- **Smart round detection**: Auto-detects max available rounds per season without hardcoded limits
- **Data preservation**: Fetching individual rounds doesn't delete others (unless full fetch)
- **Smart updates**: Fetching an existing round replaces the old data (no duplicates)
- **Persistent storage**: `data/seasons.json` preserves all historical snapshots
- **Flexible formats**: Works with both `YYYY` and `YYYY/YYYY` season formats
- **Batch operations**: Fetch multiple seasons with one command, includes automatic status reporting
- **Global monitoring**: View all available seasons and check data completeness with `-status`
- **Retry mechanism**: Use `-retry-missing` to re-fetch any missing rounds in a season

### Recommended Usage Patterns
- **Latest season**: `./get_one_season.sh -s=latest -a=fetch-all` to fetch the newest season
- **Latest round weekly**: `./get_one_season.sh -s=latest -a=fetch-last` for weekly updates
- **One-time setup**: `./get_all_seasons.sh -os=2020 -ns=latest` to fetch all historical + current data
- **Data recovery**: `./get_all_seasons.sh -status -retry-missing` to fix any incomplete seasons

## Troubleshooting

- **Fetch fails**: Check network connection or try again later
- **Parse errors**: Transfermarkt may have changed page layout; check `lib/parsers/transfermarkt.js`
- **Empty results**: Some rounds/seasons may not be available on Transfermarkt
- **Data limitations**: Ongoing seasons may not have full historical round-by-round data on Transfermarkt; consider capturing new rounds weekly with `fetch-last`
- **Timeout errors**: If fetching many seasons, the script includes delays to prevent timeouts; try again or reduce the season range

## Git integration

Add to `.gitignore` if you don't want to version control historical data:
```
data/seasons.json
```

Or keep it tracked to preserve historical snapshots.

## License

MIT
