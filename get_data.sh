#!/usr/bin/env bash
# Enhanced wrapper for the scraper with fetch/delete actions.
# Usage:
#   ./get_data.sh -s=2025 -min=1 -max=15 -a=fetch
#   ./get_data.sh -s=2025 -j=5 -a=fetch
#   ./get_data.sh -s=2025 -a=delete
#   ./get_data.sh -s=2025 -j=13 -a=delete

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  cat >&2 << 'EOF'
Usage: ./get_data.sh -s=SEASON [-j=JOURNEY|-min=MIN -max=MAX] -a=ACTION

Options:
  -s=SEASON       Season (YYYY or YYYY/YYYY) — required
  -j=JOURNEY      Single journey/round to fetch/delete (optional)
  -min=MIN        Min round for range (optional, default: 1)
  -max=MAX        Max round for range (optional, default: 1)
  -a=ACTION       Action: fetch or delete (required)

Examples:
  Fetch rounds 1-15:
    ./get_data.sh -s=2025 -min=1 -max=15 -a=fetch

  Fetch only round 5:
    ./get_data.sh -s=2025 -j=5 -a=fetch

  Delete entire season:
    ./get_data.sh -s=2025 -a=delete

  Delete only round 13:
    ./get_data.sh -s=2025 -j=13 -a=delete
EOF
  exit 2
}

# Parse arguments
season=""
journey=""
min=""
max=""
action=""

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage ;;
    -s=*) season="${arg#-s=}" ;;
    -j=*) journey="${arg#-j=}" ;;
    -min=*) min="${arg#-min=}" ;;
    -max=*) max="${arg#-max=}" ;;
    -a=*) action="${arg#-a=}" ;;
    *) printf '%s\n' "Unknown option: $arg" >&2; usage ;;
  esac
done

# Validate required parameters
if [ -z "$season" ]; then
  printf '%s\n' "Error: -s=SEASON is required" >&2
  usage
fi

if [ -z "$action" ]; then
  printf '%s\n' "Error: -a=ACTION is required" >&2
  usage
fi

# Validate season format
if ! [[ "$season" =~ ^[0-9]{4}([/][0-9]{4})?$ ]]; then
  printf '%s\n' "Invalid season format: $season. Use YYYY or YYYY/YYYY" >&2
  exit 2
fi

# Handle fetch action
if [ "$action" = "fetch" ]; then
  if [ -n "$journey" ]; then
    # Fetch specific journey
    if ! [[ "$journey" =~ ^[0-9]+$ ]]; then
      printf '%s\n' "Invalid journey value: $journey" >&2
      exit 2
    fi
    printf 'Fetching Transfermarkt — season=%s journey=%s\n' "$season" "$journey"
    if command -v npm >/dev/null 2>&1; then
      npm run scrape -- --season="$season" --min="$journey" --max="$journey"
    else
      if ! command -v node >/dev/null 2>&1; then
        printf '%s\n' "Neither npm nor node found in PATH" >&2
        exit 3
      fi
      node scrape.js --season="$season" --min="$journey" --max="$journey"
    fi
  else
    # Fetch range
    local_min=${min:-1}
    local_max=${max:-1}
    if ! [[ "$local_min" =~ ^[0-9]+$ ]]; then
      printf '%s\n' "Invalid min value: $local_min" >&2
      exit 2
    fi
    if ! [[ "$local_max" =~ ^[0-9]+$ ]]; then
      printf '%s\n' "Invalid max value: $local_max" >&2
      exit 2
    fi
    printf 'Fetching Transfermarkt — season=%s min=%s max=%s\n' "$season" "$local_min" "$local_max"
    if command -v npm >/dev/null 2>&1; then
      npm run scrape -- --season="$season" --min="$local_min" --max="$local_max"
    else
      if ! command -v node >/dev/null 2>&1; then
        printf '%s\n' "Neither npm nor node found in PATH" >&2
        exit 3
      fi
      node scrape.js --season="$season" --min="$local_min" --max="$local_max"
    fi
  fi

# Handle delete action
elif [ "$action" = "delete" ]; then
  db_file="$SCRIPT_DIR/data/standings.json"
  if [ ! -f "$db_file" ]; then
    printf '%s\n' "Error: $db_file not found" >&2
    exit 3
  fi

  if [ -n "$journey" ]; then
    # Delete specific journey
    if ! [[ "$journey" =~ ^[0-9]+$ ]]; then
      printf '%s\n' "Invalid journey value: $journey" >&2
      exit 2
    fi
    printf 'Deleting journey %s from season %s...\n' "$journey" "$season"
    node -e "
      const fs = require('fs');
      const db = JSON.parse(fs.readFileSync('$db_file', 'utf8'));
      if (db['$season']) {
        db['$season'] = db['$season'].filter(snapshot => snapshot.round !== $journey);
        fs.writeFileSync('$db_file', JSON.stringify(db, null, 2), 'utf8');
        console.log('Deleted journey $journey from season $season');
      } else {
        console.log('Season $season not found');
      }
    "
  else
    # Delete entire season
    printf 'Deleting entire season %s...\n' "$season"
    node -e "
      const fs = require('fs');
      const db = JSON.parse(fs.readFileSync('$db_file', 'utf8'));
      if (db['$season']) {
        delete db['$season'];
        fs.writeFileSync('$db_file', JSON.stringify(db, null, 2), 'utf8');
        console.log('Deleted season $season');
      } else {
        console.log('Season $season not found');
      }
    "
  fi

else
  printf '%s\n' "Error: Unknown action '$action'. Use 'fetch' or 'delete'" >&2
  usage
fi

exit 0
