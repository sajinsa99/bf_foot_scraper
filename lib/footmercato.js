const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://www.footmercato.net/france/ligue-1/classement';

function parseIntSafe(s) {
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function cleanTeamName(text) {
  if (!text) return '';
  let t = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/Logo\s*/i, '').trim();
  // collapse duplicate words like "Lens Lens"
  const parts = t.split(' ');
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (last === secondLast) parts.pop();
  }
  return parts.join(' ');
}

async function fetchStandings() {
  const res = await axios.get(URL, { timeout: 15000, headers: { 'User-Agent': 'bf_foot_scraper/0.1' } });
  const $ = cheerio.load(res.data);

  // find season text like 2025/2026
  let season = null;
  const seasonMatch = $('body').text().match(/(\d{4}\/\d{4})/);
  if (seasonMatch) season = seasonMatch[1];

  // find first table-looking element
  const table = $('table').first();
  const clubs = [];

  if (table && table.length) {
    table.find('tr').each((i, tr) => {
      const tds = $(tr).find('td');
      if (!tds || tds.length < 6) return;
      const cells = [];
      tds.each((j, td) => cells.push($(td).text().trim()));
      // Expect columns: pos, team, points, played, gd, wins, draws, losses, gf, ga
      if (cells.length >= 9) {
        const position = parseIntSafe(cells[0]);
        const name = cleanTeamName(cells[1]);
        const points = parseIntSafe(cells[2]);
        const played = parseIntSafe(cells[3]);
        const goal_difference = parseIntSafe(cells[4]);
        const wins = parseIntSafe(cells[5]);
        const draws = parseIntSafe(cells[6]);
        const losses = parseIntSafe(cells[7]);
        const goals_for = parseIntSafe(cells[8]);
        const goals_against = parseIntSafe(cells[9] || '');

        if (name) {
          clubs.push({ position, name, points, played, goal_difference, wins, draws, losses, goals_for, goals_against });
        }
      }
    });
  }

  // Fallback: try to extract lines like "| 1 | Logo Lens Lens | 34 | 15 | +13 | ..."
  if (clubs.length === 0) {
    const body = res.data;
    const re = /\|\s*(\d+)\s*\|\s*([^|]+)\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([+-]?\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/g;
    let m;
    while ((m = re.exec(body))) {
      const position = parseIntSafe(m[1]);
      const name = cleanTeamName(m[2]);
      const points = parseIntSafe(m[3]);
      const played = parseIntSafe(m[4]);
      const goal_difference = parseIntSafe(m[5]);
      const wins = parseIntSafe(m[6]);
      const draws = parseIntSafe(m[7]);
      const losses = parseIntSafe(m[8]);
      const goals_for = parseIntSafe(m[9]);
      const goals_against = parseIntSafe(m[10]);
      clubs.push({ position, name, points, played, goal_difference, wins, draws, losses, goals_for, goals_against });
    }
  }

  return { season: season || 'unknown', clubs };
}

module.exports = { fetchStandings, URL };
