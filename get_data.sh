#!/usr/bin/env bash
# Wrapper to call the npm scraper for Transfermarkt rounds.
# Usage:
#   ./get_data.sh SEASON MAX
# Examples:
#   ./get_data.sh 2025 14   -> season=2025, rounds 1 to 14

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  printf '%s\n' "Usage: $0 SEASON MAX" >&2
  printf '%s\n' "Example: $0 2025 14" >&2
  exit 2
}

if [ "$#" -ne 2 ]; then
  usage
fi

season=$1
max=$2

# Validate season: accept YYYY or YYYY/YYYY
if ! [[ "$season" =~ ^[0-9]{4}([/][0-9]{4})?$ ]]; then
  printf '%s\n' "Invalid season format: $season. Use YYYY or YYYY/YYYY" >&2
  exit 2
fi

# Validate numeric max
if ! [[ "$max" =~ ^[0-9]+$ ]]; then
  printf '%s\n' "Invalid max value: $max" >&2
  exit 2
fi

printf 'Scraping Transfermarkt — season=%s max=%s\n' "$season" "$max"

if command -v npm >/dev/null 2>&1; then
  # Forward arguments to npm script. npm requires `--` to forward CLI args.
  npm run scrape -- "$max" --season="$season"
else
  # Fallback to node if npm is not available
  if ! command -v node >/dev/null 2>&1; then
    printf '%s\n' "Neither npm nor node found in PATH" >&2
    exit 3
  fi
  node scrape.js "$max" --season="$season"
fi

exit 0
