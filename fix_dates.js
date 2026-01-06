// Fix synthetic data dates
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/seasons.json', 'utf8'));

const season = '2025/2026';
let snapshots = data[season];

// Add proper dates to synthetic snapshots
snapshots.forEach((snap, i) => {
  if (snap.source === 'synthetic-evolution' && !snap.date) {
    // Create dates going backwards from current date
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - (snapshots.length - 1 - i) * 7); // 1 week apart
    snap.date = baseDate.toISOString();
    snap.matchday = snap.matchday || (12 + i);
  }
});

// Save back
fs.writeFileSync('data/seasons.json', JSON.stringify(data, null, 2));
console.log('Added dates to synthetic snapshots');