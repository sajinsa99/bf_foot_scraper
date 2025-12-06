#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { fetchStandings, URL } = require('./lib/footmercato');

async function main() {
  try {
    const { season, clubs } = await fetchStandings();
    const snapshot = {
      date: new Date().toISOString(),
      source: URL,
      clubs
    };

    const dataDir = path.resolve(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbFile = path.join(dataDir, 'standings.json');
    let db = {};
    if (fs.existsSync(dbFile)) {
      try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8') || '{}'); } catch (err) { db = {}; }
    }

    if (!db[season]) db[season] = [];
    db[season].push(snapshot);

    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
    console.log(`Saved snapshot for season ${season} (${snapshot.date}) to ${dbFile}`);
  } catch (err) {
    console.error('Error while scraping:', err.message || err);
    process.exit(2);
  }
}

main();
