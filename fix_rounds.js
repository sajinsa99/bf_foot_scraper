const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/standings.json', 'utf8'));
for (const season in data) {
  data[season].forEach(snap => {
    if (!snap.round) {
      snap.round = Math.max(...snap.clubs.map(c => c.played || 0));
    }
  });
}
fs.writeFileSync('data/standings.json', JSON.stringify(data, null, 2));
console.log('Updated data with round info');