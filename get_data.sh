#!/usr/bin/env bash
# Wrapper to call the npm scraper for Transfermarkt rounds.
# Usage:
#   ./get_data.sh SEASON MAX [MIN]
# Examples:
#   ./get_data.sh 2025 14 1   -> season=2025, min=1, max=14
#   ./get_data.sh 2025 14     -> season=2025, min=14, max=14

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  printf '%s\n' "Usage: $0 SEASON MAX [MIN]" >&2
  printf '%s\n' "Example: $0 2025 14 1" >&2
  exit 2
}

if [ "$#" -lt 2 ]; then
  usage
fi

season=$1
max=$2
min=${3:-}

# If min omitted, use max
if [ -z "$min" ]; then
  min=$max
fi

# Validate season: accept YYYY or YYYY/YYYY
if ! [[ "$season" =~ ^[0-9]{4}([/][0-9]{4})?$ ]]; then
  printf '%s\n' "Invalid season format: $season. Use YYYY or YYYY/YYYY" >&2
  exit 2
fi

# Validate numeric min/max
if ! [[ "$max" =~ ^[0-9]+$ ]]; then
  printf '%s\n' "Invalid max value: $max" >&2
  exit 2
fi
if ! [[ "$min" =~ ^[0-9]+$ ]]; then
  printf '%s\n' "Invalid min value: $min" >&2
  exit 2
fi

printf 'Scraping Transfermarkt — season=%s min=%s max=%s\n' "$season" "$min" "$max"

if command -v npm >/dev/null 2>&1; then
  # Forward arguments to npm script. npm requires `--` to forward CLI args.
  npm run scrape -- --source=transfermarkt --season="$season" --min="$min" --max="$max"
else
  # Fallback to node if npm is not available
  if ! command -v node >/dev/null 2>&1; then
    printf '%s\n' "Neither npm nor node found in PATH" >&2
    exit 3
  fi
  node scrape.js --source=transfermarkt --season="$season" --min="$min" --max="$max"
fi

exit 0
