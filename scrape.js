#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const minimist = require('minimist');

// Parsers
const footmercato = require('./lib/parsers/footmercato');
const transfermarkt = require('./lib/parsers/transfermarkt');

const argv = minimist(process.argv.slice(2));

async function saveSnapshot(seasonKey, snapshot) {
  const dataDir = path.resolve(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbFile = path.join(dataDir, 'standings.json');
  let db = {};
  if (fs.existsSync(dbFile)) {
    try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}'); } catch (err) { db = {}; }
  }
  if (!db[seasonKey]) db[seasonKey] = [];
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
      // determine min/max
      let min = argv.min || argv.m || null;
      let max = argv.max || argv.M || null;
      if (roundArg && !min && !max) {
        min = roundArg;
        max = roundArg;
      }
      min = min ? Number(min) : 1;
      max = max ? Number(max) : min;

      for (let r = min; r <= max; r += 1) {
        const res = await transfermarkt.fetchRound({ season: seasonOpt || String(new Date().getFullYear()), min: r, max: r });
        const snapshot = {
          date: new Date().toISOString(),
          source: 'transfermarkt',
          url: res.url,
          params: res.params,
          round: r,
          snapshot_type: res.snapshot_type,
          clubs: res.clubs
        };
        await saveSnapshot(seasonKey, snapshot);
        // small delay to be polite
        await new Promise((resDelay) => setTimeout(resDelay, 1200));
      }
      return;
    }

    // default: footmercato
    const res = await footmercato.fetchStandings();
    const snapshot = { date: new Date().toISOString(), source: footmercato.URL, clubs: res.clubs };
    await saveSnapshot(res.season || seasonKey, snapshot);
  } catch (err) {
    console.error('Error while scraping:', err && (err.stack || err.message || err));
    process.exit(2);
  }
}

main();
