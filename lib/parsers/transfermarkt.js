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

  // Find the standings table - look for table with 19 rows (18 teams + 1 header)
  const allTables = $('table');
  let standingsTable = null;

  allTables.each((i, table) => {
    const rows = $(table).find('tr');
    if (rows.length === 19) { // Standings table has exactly 19 rows (18 teams + header)
      const firstDataRow = rows.eq(1);
      const cells = firstDataRow.find('td');
      if (cells.length >= 10) {
        const cellTexts = cells.map((j, cell) => $(cell).text().trim()).get();
        // Check if first cell is a position number and 3rd cell is a team name
        if (/^\d+$/.test(cellTexts[0]) && cellTexts[2].length > 2) {
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
      if (cells.length >= 10) {
        const cellTexts = cells.map((j, cell) => $(cell).text().trim()).get();

        // Format: [position, logo, name, played, wins, draws, losses, goals, goal_diff, points]
        const position = parseIntSafe(cellTexts[0]);
        const name = cleanTeamName(cellTexts[2]);
        const played = parseIntSafe(cellTexts[3]);
        const wins = parseIntSafe(cellTexts[4]);
        const draws = parseIntSafe(cellTexts[5]);
        const losses = parseIntSafe(cellTexts[6]);
        
        // Goals format: "32:13" -> extract both
        const goalsStr = cellTexts[7];
        let goals_for = null;
        let goals_against = null;
        if (goalsStr && goalsStr.includes(':')) {
          const [gf, ga] = goalsStr.split(':');
          goals_for = parseIntSafe(gf);
          goals_against = parseIntSafe(ga);
        }
        
        const goal_difference = parseIntSafe(cellTexts[8]);
        const points = parseIntSafe(cellTexts[9]);

        if (position && name && name.length > 2) {
          clubs.push({
            position,
            name,
            played,
            goal_difference,
            points,
            goals_for,
            goals_against,
            wins,
            draws,
            losses
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

async function getLatestSeason() {
  const baseUrl = 'https://www.transfermarkt.fr/ligue-1/startseite/wettbewerb/FR1';
  try {
    const res = await axios.get(baseUrl, { timeout: 15000, headers: { 'User-Agent': 'bf_foot_scraper/0.1' } });
    const $ = cheerio.load(res.data);
    
    const seasons = [];
    // Find season links in the navigation
    $('select[name="saison_id"] option, a[href*="saison_id"]').each((i, elem) => {
      const $elem = $(elem);
      const href = $elem.attr('href') || '';
      const value = $elem.attr('value') || '';
      
      // Try to extract season from href or value
      const hrefMatch = href.match(/saison_id[=\/](\d+)/);
      const valueMatch = value.match(/\d+/);
      
      if (hrefMatch) {
        seasons.push(parseInt(hrefMatch[1]));
      } else if (valueMatch && value !== '') {
        seasons.push(parseInt(valueMatch[0]));
      }
    });
    
    if (seasons.length === 0) {
      console.error('No seasons found on Transfermarkt');
      return null;
    }
    
    const latestYear = Math.max(...seasons);
    // Convert year to season format (2025 -> 2025/2026)
    const nextYear = latestYear + 1;
    return `${latestYear}/${nextYear}`;
  } catch (err) {
    console.error('Failed to get latest season:', err.message);
    return null;
  }
}

module.exports = { fetchStandings, getMaxRound, getLatestSeason };
