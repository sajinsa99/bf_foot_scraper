const axios = require('axios');
const cheerio = require('cheerio');

// Parse Transfermarkt standings table for Ligue 1.
// Example URL:
// https://www.transfermarkt.fr/ligue-1/startseite/wettbewerb/FR1/saison_id/2024

function parseIntSafe(s) {
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function cleanTeamName(text) {
  if (!text) return '';
  let t = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  // Remove leading digits or ranking markers
  t = t.replace(/^\d+\.?\s*/, '').trim();
  return t;
}

async function fetchStandings({ season = '2024', round = null, cacheRaw = false }) {
  const baseUrl = round 
    ? `https://www.transfermarkt.fr/ligue-1/spieltagtabelle/wettbewerb/FR1/saison_id/${encodeURIComponent(String(season))}/spieltag/${round}`
    : `https://www.transfermarkt.fr/ligue-1/startseite/wettbewerb/FR1/saison_id/${encodeURIComponent(String(season))}`;
  const res = await axios.get(baseUrl, { timeout: 15000, headers: { 'User-Agent': 'bf_foot_scraper/0.1' } });
  const $ = cheerio.load(res.data);

  const clubs = [];

  // Find the standings table (it's typically table 5 based on our analysis)
  const allTables = $('table');
  let standingsTable = null;

  // Look for the table with standings data (19 rows, positions, team names, points)
  allTables.each((i, table) => {
    const rows = $(table).find('tr');
    if (rows.length >= 19) { // Standings table has 19 rows (18 teams + header)
      const firstDataRow = rows.eq(1);
      const cells = firstDataRow.find('td');
      if (cells.length >= 6) {
        const cellTexts = cells.map((j, cell) => $(cell).text().trim()).get();
        // Check if first cell is a position number
        if (/^\d+$/.test(cellTexts[0])) {
          standingsTable = $(table);
          return false; // Break out of each loop
        }
      }
    }
  });

  if (standingsTable) {
    const rows = standingsTable.find('tr');

    rows.each((i, row) => {
      if (i === 0) return; // Skip header

      const cells = $(row).find('td');
      if (cells.length >= 6) {
        const cellTexts = cells.map((j, cell) => $(cell).text().trim()).get();

        // Format: [position, empty, name, played, goal_diff, points]
        const position = parseIntSafe(cellTexts[0]);
        const name = cleanTeamName(cellTexts[2]);
        const played = parseIntSafe(cellTexts[3]);
        const goal_difference = parseIntSafe(cellTexts[4]);
        const points = parseIntSafe(cellTexts[5]);

        if (position && name && name.length > 2) {
          clubs.push({
            position,
            name,
            played,
            goal_difference,
            points,
            goals_for: null, // Not available in this table
            goals_against: null, // Not available in this table
            wins: null,
            draws: null,
            losses: null
          });
        }
      }
    });
  }

  return {
    season: String(season),
    clubs,
    url: baseUrl,
    params: { season, round },
    snapshot_type: round ? 'round_standings' : 'final_standings'
  };
}

async function getMaxRound(season = '2025') {
  const baseUrl = `https://www.transfermarkt.fr/ligue-1/spieltagtabelle/wettbewerb/FR1/saison_id/${encodeURIComponent(String(season))}`;
  try {
    const res = await axios.get(baseUrl, { timeout: 15000, headers: { 'User-Agent': 'bf_foot_scraper/0.1' } });
    const $ = cheerio.load(res.data);
    
    const rounds = [];
    $('a[href*="spieltag"]').each((i, elem) => {
      const href = $(elem).attr('href');
      const match = href.match(/spieltag[=\/](\d+)/);
      if (match) {
        rounds.push(parseInt(match[1]));
      }
    });
    
    const unique = [...new Set(rounds)];
    return unique.length > 0 ? Math.max(...unique) : null;
  } catch (err) {
    console.error(`Failed to get max round for season ${season}:`, err.message);
    return null;
  }
}

module.exports = { fetchStandings, getMaxRound };
