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
Usage: ./get_data.sh [-s=SEASON] [-j=JOURNEY] -a=ACTION [-min=MIN] [-max=MAX]

Options:
  -s=SEASON       Season (YYYY or YYYY/YYYY) — required for fetch/delete
  -j=JOURNEY      Journey/round(s) to fetch/delete (optional)
                  Can be single: -j=5 or comma-separated: -j=13,15,17
  -a=ACTION       Action: fetch, delete, or status (required)
  -min=MIN        Min round for range (optional, default: 1)
  -max=MAX        Max round for range (optional, default: 38)
  -h, --help      Display help message

Examples:
  List all available seasons:
    ./get_data.sh -a=status

  List available journeys for season 2025:
    ./get_data.sh -s=2025 -a=status

  Check if journey 15 exists for season 2025:
    ./get_data.sh -s=2025 -j=15 -a=status

  Check multiple journeys (13, 15, 17) for season 2025:
    ./get_data.sh -s=2025 -j=13,15,17 -a=status

  Fetch rounds 1-15:
    ./get_data.sh -s=2025 -min=1 -max=15 -a=fetch

  Fetch only round 5:
    ./get_data.sh -s=2025 -j=5 -a=fetch

  Fetch multiple specific rounds:
    ./get_data.sh -s=2025 -j=13,15,17 -a=fetch

  Delete entire season:
    ./get_data.sh -s=2025 -a=delete

  Delete only round 13:
    ./get_data.sh -s=2025 -j=13 -a=delete

  Delete multiple specific rounds:
    ./get_data.sh -s=2025 -j=13,15,17 -a=delete
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

# Validate that action is set
if [ -z "$action" ]; then
  printf '%s\n' "Error: -a=ACTION is required" >&2
  usage
fi

# Handle status action
if [ "$action" = "status" ]; then
  db_file="$SCRIPT_DIR/data/seasons.json"
  
  if [ ! -f "$db_file" ]; then
    printf '%s\n' "Error: $db_file not found" >&2
    exit 3
  fi
  
  if [ -z "$season" ]; then
    # List all available seasons
    printf 'Available seasons:\n'
    node -e "
      const fs = require('fs');
      const db = JSON.parse(fs.readFileSync('$db_file', 'utf8'));
      const seasons = Object.keys(db).sort();
      if (seasons.length === 0) {
        console.log('  (no seasons available)');
      } else {
        seasons.forEach(s => console.log('  ' + s));
      }
    "
    exit 0
  else
    if [ -z "$journey" ]; then
      # List available journeys for a season
      printf 'Available journeys for season %s:\n' "$season"
      node -e "
        const fs = require('fs');
        const db = JSON.parse(fs.readFileSync('$db_file', 'utf8'));
        if (!db['$season']) {
          console.log('  (season not found)');
        } else {
          const rounds = db['$season'].map(s => s.round).sort((a, b) => a - b);
          if (rounds.length === 0) {
            console.log('  (no journeys available)');
          } else {
            const minRound = Math.min(...rounds);
            const maxRound = Math.max(...rounds);
            console.log('  Journeys: ' + minRound + ' to ' + maxRound);
            console.log('  Available: ' + rounds.join(', '));
            
            // Check for missing journeys
            const missing = [];
            for (let i = minRound; i <= maxRound; i++) {
              if (!rounds.includes(i)) {
                missing.push(i);
              }
            }
            if (missing.length > 0) {
              console.log('  ⚠ Missing journeys: ' + missing.join(', '));
            }
          }
        }
      "
      exit 0
    else
      # Check if specific journey(s) exist
      node -e "
        const fs = require('fs');
        const db = JSON.parse(fs.readFileSync('$db_file', 'utf8'));
        if (!db['$season']) {
          console.log('Season $season not found');
          process.exit(1);
        }
        const journeyStr = '$journey';
        const journeys = journeyStr.includes(',') ? journeyStr.split(',').map(j => parseInt(j.trim())) : [parseInt(journeyStr)];
        const available = db['$season'].map(s => s.round);
        let allFound = true;
        journeys.forEach(j => {
          if (available.includes(j)) {
            console.log('✓ Journey ' + j + ' is available');
          } else {
            console.log('✗ Journey ' + j + ' is NOT available');
            allFound = false;
          }
        });
        process.exit(allFound ? 0 : 1);
      "
      exit $?
    fi
  fi
fi

# Validate required parameters for fetch/delete
if [ -z "$season" ]; then
  printf '%s\n' "Error: -s=SEASON is required" >&2
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
    # Fetch specific journey(s) — can be single or comma-separated
    # Validate journey format
    if ! [[ "$journey" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
      printf '%s\n' "Invalid journey value: $journey. Use format: 5 or 13,15,17" >&2
      exit 2
    fi
    
    # If comma-separated, fetch each one individually
    if [[ "$journey" == *","* ]]; then
      IFS=',' read -ra journeys <<< "$journey"
      for j in "${journeys[@]}"; do
        printf 'Fetching Transfermarkt — season=%s journey=%s\n' "$season" "$j"
        if command -v npm >/dev/null 2>&1; then
          npm run scrape -- --season="$season" --min="$j" --max="$j"
        else
          if ! command -v node >/dev/null 2>&1; then
            printf '%s\n' "Neither npm nor node found in PATH" >&2
            exit 3
          fi
          node scrape.js --season="$season" --min="$j" --max="$j"
        fi
      done
    else
      # Single journey
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
    fi
  else
    # Fetch range
    local_min=${min:-1}
    local_max=${max:-38}
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
  db_file="$SCRIPT_DIR/data/seasons.json"
  if [ ! -f "$db_file" ]; then
    printf '%s\n' "Error: $db_file not found" >&2
    exit 3
  fi

  if [ -n "$journey" ]; then
    # Delete specific journey(s) — can be single or comma-separated
    if ! [[ "$journey" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
      printf '%s\n' "Invalid journey value: $journey. Use format: 5 or 13,15,17" >&2
      exit 2
    fi
    
    # If comma-separated, delete all of them
    if [[ "$journey" == *","* ]]; then
      IFS=',' read -ra journeys <<< "$journey"
      printf 'Deleting journeys %s from season %s...\n' "$journey" "$season"
      node -e "
        const fs = require('fs');
        const db = JSON.parse(fs.readFileSync('$db_file', 'utf8'));
        if (db['$season']) {
          const journeyList = [$(printf '%s,' "${journeys[@]}" | sed 's/,$//')];
          db['$season'] = db['$season'].filter(snapshot => !journeyList.includes(snapshot.round));
          fs.writeFileSync('$db_file', JSON.stringify(db, null, 2), 'utf8');
          console.log('Deleted journeys from season $season');
        } else {
          console.log('Season $season not found');
        }
      "
    else
      # Single journey
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
    fi
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
  printf '%s\n' "Error: Unknown action '$action'. Use 'fetch', 'delete', or 'status'" >&2
  usage
fi

exit 0
