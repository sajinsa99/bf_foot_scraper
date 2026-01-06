// Create synthetic evolution data for testing charts
const fs = require('fs');

const currentData = JSON.parse(fs.readFileSync('data/seasons.json', 'utf8'));
const season = '2025/2026';
let snapshots = currentData[season] || [];

// Find the current FootMercato snapshot
const currentSnapshot = snapshots.find(s => s.source.includes('footmercato'));
if (!currentSnapshot) {
  console.log('No FootMercato data found');
  process.exit(1);
}

console.log('Current snapshot has', currentSnapshot.clubs.length, 'clubs');

// Create synthetic evolution data by modifying the current standings
const baseClubs = currentSnapshot.clubs.slice(0, 10); // Top 10 teams

// Create 5 snapshots simulating matchday progression
const evolutionSnapshots = [];
for (let matchday = 12; matchday <= 16; matchday++) {
  const modifiedClubs = baseClubs.map((club, index) => ({
    ...club,
    // Simulate some position changes and point accumulation
    position: Math.max(1, club.position + Math.floor(Math.random() * 3) - 1),
    points: club.points + Math.floor(matchday / 2) + Math.floor(Math.random() * 3),
    played: matchday,
    goals_for: club.goals_for + Math.floor(matchday / 3) + Math.floor(Math.random() * 2),
    goals_against: club.goals_against + Math.floor(matchday / 4) + Math.floor(Math.random() * 2)
  })).map(club => ({
    ...club,
    goal_difference: club.goals_for - club.goals_against
  })).sort((a, b) => {
    // Sort by points desc, then goal difference desc
    if (a.points !== b.points) return b.points - a.points;
    return b.goal_difference - a.goal_difference;
  }).map((club, index) => ({
    ...club,
    position: index + 1
  }));

  const snapshot = {
    source: 'synthetic-evolution',
    season: season,
    matchday: matchday,
    clubs: modifiedClubs
  };

  evolutionSnapshots.push(snapshot);
}

console.log('Created', evolutionSnapshots.length, 'synthetic snapshots');

// Add to the data
currentData[season] = [...snapshots, ...evolutionSnapshots];

// Save back
fs.writeFileSync('data/seasons.json', JSON.stringify(currentData, null, 2));
console.log('Saved synthetic evolution data');