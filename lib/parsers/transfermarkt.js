const axios = require('axios');
const cheerio = require('cheerio');

// Parse Transfermarkt form/standing table for Ligue 1.
// Example URL:
// https://www.transfermarkt.fr/ligue-1/formtabelle/wettbewerb/FR1?saison_id=2025&min=1&max=1

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

async function fetchRound({ season = '2025', min = 1, max = 1, cacheRaw = false }) {
  const base = 'https://www.transfermarkt.fr/ligue-1/formtabelle/wettbewerb/FR1';
  const url = `${base}?saison_id=${encodeURIComponent(String(season))}&min=${encodeURIComponent(String(min))}&max=${encodeURIComponent(String(max))}`;
  const res = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'bf_foot_scraper/0.1' } });
  const $ = cheerio.load(res.data);

  const clubs = [];

  // Try to find a table with class 'items' or the first table on the page
  let table = $('table.items').first();
  if (!table || table.length === 0) table = $('table').first();

  if (table && table.length) {
    table.find('tr').each((i, tr) => {
      const tds = $(tr).find('td');
      if (!tds || tds.length < 2) return;
      const cells = [];
      tds.each((j, td) => cells.push($(td).text().trim()));
      // Heuristic: name in one of the cells, points usually a number cell
      // We'll try to find a numeric cell for points and a text cell for name
      let name = null;
      let points = null;
      let position = null;
      let played = null;
      let goal_difference = null;
      let goals_for = null;
      let goals_against = null;

      // Flatten cell texts and try to pick out numbers
      for (let k = 0; k < cells.length; k += 1) {
        const c = cells[k];
        if (!name && /[A-Za-zÀ-ÿ\- ]{3,}/.test(c)) {
          name = cleanTeamName(c.replace(/Logo\s*/i, '').trim());
        }
      }

      // pick last numeric cell as points
      for (let k = cells.length - 1; k >= 0; k -= 1) {
        const n = parseInt(String(cells[k]).replace(/[^0-9-]/g, ''), 10);
        if (!Number.isNaN(n)) { points = n; break; }
      }

      // try position from first numeric cell
      for (let k = 0; k < cells.length; k += 1) {
        const n = parseInt(String(cells[k]).replace(/[^0-9-]/g, ''), 10);
        if (!Number.isNaN(n)) { position = n; break; }
      }

      if (name) {
        clubs.push({ position, name, points, played, goal_difference, goals_for, goals_against });
      }
    });
  }

  // Fallback: regex scan of the raw HTML for table-like markup (very coarse)
  if (clubs.length === 0) {
    const body = res.data;
    const re = /<tr[^>]*>\s*<td[^>]*>\s*(?:<span[^>]*>\s*)?(\d+)[^<]*<[^>]*>\s*(?:.*?)<a[^>]*>([^<]+)<\/a>(?:[\s\S]*?)<td[^>]*>\s*(\d+)\s*<\/td>/g;
    let m;
    while ((m = re.exec(body))) {
      const position = parseIntSafe(m[1]);
      const name = cleanTeamName(m[2]);
      const points = parseIntSafe(m[3]);
      clubs.push({ position, name, points });
    }
  }

  return { season: String(season), clubs, url, params: { min, max }, snapshot_type: 'matchday' };
}

module.exports = { fetchRound };
