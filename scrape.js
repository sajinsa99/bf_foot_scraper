#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const minimist = require('minimist');

// Parsers
const footmercato = require('./lib/parsers/footmercato');
const transfermarkt = require('./lib/parsers/transfermarkt');

const argv = minimist(process.argv.slice(2));

async function saveSnapshot(seasonKey, snapshot, clearPrevious = false) {
  const dataDir = path.resolve(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbFile = path.join(dataDir, 'standings.json');
  let db = {};
  if (fs.existsSync(dbFile)) {
    try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}'); } catch (err) { db = {}; }
  }
  if (clearPrevious || !db[seasonKey]) db[seasonKey] = [];
  db[seasonKey].push(snapshot);
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Saved snapshot for season ${seasonKey} (${snapshot.date}) to ${dbFile}`);
}

function normalizeSeason(input) {
  if (!input) return null;
  // Accept formats like '2025' or '2025/2026'
  if (/^\d{4}\/\d{4}$/.test(input)) return input;
  if (/^\d{4}$/.test(input)) return `${input}/${String(Number(input) + 1)}`;
  return input;
}

async function main() {
  try {
    // CLI behavior:
    // node scrape.js                -> default: footmercato current standings
    // node scrape.js <round>        -> transfermarkt for default season (2025) round
    // node scrape.js --source=transfermarkt --min=1 --max=1 --season=2025

    const positional = argv._ || [];
    const roundArg = positional.length > 0 ? positional[0] : null;

    const source = argv.source || (roundArg ? 'transfermarkt' : 'footmercato');
    const seasonOpt = argv.season || argv.s || (roundArg ? String(new Date().getFullYear()) : null);
    const seasonKey = normalizeSeason(seasonOpt) || '2025/2026';

    if (source === 'transfermarkt') {
      const season = argv.season || argv.s || String(new Date().getFullYear());
      const seasonKey = normalizeSeason(season) || '2025/2026';

      if (roundArg) {
        // Fetch standings for each round from 1 to roundArg
        const maxRound = parseInt(roundArg, 10);
        for (let round = 1; round <= maxRound; round++) {
          console.log(`Fetching standings for season ${season}, round ${round}...`);
          const res = await transfermarkt.fetchStandings({ season: String(season), round });
          const snapshot = {
            date: new Date().toISOString(),
            source: 'transfermarkt',
            url: res.url,
            params: res.params,
            season: res.season,
            round: round,
            snapshot_type: res.snapshot_type,
            clubs: res.clubs
          };
          await saveSnapshot(seasonKey, snapshot, round === 1);
          // small delay to be polite
          await new Promise((resDelay) => setTimeout(resDelay, 1200));
        }
      } else {
        // For transfermarkt, get historical final standings for multiple seasons
        let seasons = argv.seasons || argv.season || [String(new Date().getFullYear())];
        if (!Array.isArray(seasons)) seasons = [seasons];
        
        // Default to last 3 seasons if no specific seasons requested
        if (seasons.length === 1 && !argv.seasons && !argv.season) {
          const currentYear = new Date().getFullYear();
          seasons = [currentYear - 2, currentYear - 1, currentYear];
        }
        
        for (const season of seasons) {
          console.log(`Fetching final standings for season ${season}...`);
          const res = await transfermarkt.fetchStandings({ season: String(season) });
          const snapshot = {
            date: new Date().toISOString(),
            source: 'transfermarkt',
            url: res.url,
            params: res.params,
            season: res.season,
            snapshot_type: res.snapshot_type,
            clubs: res.clubs
          };
          const seasonKey = normalizeSeason(season) || `${season}/${String(Number(season) + 1)}`;
          await saveSnapshot(seasonKey, snapshot);
          // small delay to be polite
          await new Promise((resDelay) => setTimeout(resDelay, 1200));
        }
      }
      return;
    }

    // default: footmercato
    const res = await footmercato.fetchStandings();
    const snapshot = { 
      date: new Date().toISOString(), 
      source: footmercato.URL, 
      clubs: res.clubs,
      round: Math.max(...res.clubs.map(c => c.played || 0))
    };
    await saveSnapshot(res.season || seasonKey, snapshot);
  } catch (err) {
    console.error('Error while scraping:', err && (err.stack || err.message || err));
    process.exit(2);
  }
}

main();
