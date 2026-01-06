// Check data summary
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/seasons.json', 'utf8'));

console.log('Available seasons:', Object.keys(data).sort());

Object.keys(data).sort().forEach(season => {
  const snapshots = data[season];
  const validSnaps = snapshots.filter(snap =>
    snap.clubs && snap.clubs.some(c => c && c.name && !c.name.includes('Sélectionner') && c.position)
  );

  if (validSnaps.length > 0) {
    const latest = validSnaps[validSnaps.length - 1];
    console.log(`${season}: ${validSnaps.length} valid snapshots, latest has ${latest.clubs.length} clubs`);
    console.log(`  Champion: ${latest.clubs[0]?.name} (${latest.clubs[0]?.points} pts)`);
  }
});