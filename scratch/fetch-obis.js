const https = require('https');
const fs = require('fs');

function fetchObis(query) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.obis.org/v3/occurrence?${query}`, (res) => {
      let d='';
      res.on('data', c=>d+=c);
      res.on('end', ()=>resolve(JSON.parse(d).results));
    }).on('error', reject);
  });
}

async function main() {
  console.log("Fetching turtle from OBIS...");
  // Use a specific dataset if possible, or just 100 points
  const turtles = await fetchObis('scientificname=Chelonia%20mydas&size=200&sort=eventDate');
  
  // Try to group by dataset_id or recordedBy to get a "track"
  let bestTurtleGroup = [];
  const tGroups = {};
  turtles.forEach(t => {
    const key = t.dataset_id || t.recordedBy || 'unknown';
    if (!tGroups[key]) tGroups[key] = [];
    tGroups[key].push(t);
  });
  for (const k in tGroups) {
    if (tGroups[k].length > bestTurtleGroup.length) bestTurtleGroup = tGroups[k];
  }

  const tTrack = {
    id: "obis-turtle-1",
    individualName: "OBIS Green Turtle",
    species: "Chelonia mydas",
    commonName: "Green Sea Turtle",
    studyId: 999991,
    studyName: "OBIS Public Observations",
    color: "#10b981",
    animalType: "reptile",
    coordinates: bestTurtleGroup.filter(t=>t.decimalLongitude && t.decimalLatitude).map(t => ({
      longitude: parseFloat(t.decimalLongitude),
      latitude: parseFloat(t.decimalLatitude),
      timestamp: t.eventDate ? new Date(t.eventDate).getTime() : Date.now() - Math.random()*1000000
    })).sort((a,b) => a.timestamp - b.timestamp).slice(-20) // take last 20
  };
  tTrack.currentPosition = [
    tTrack.coordinates[tTrack.coordinates.length-1].longitude,
    tTrack.coordinates[tTrack.coordinates.length-1].latitude
  ];
  tTrack.tags = ["reptile", "marine", "obis"];

  console.log("Fetching whale from OBIS...");
  const whales = await fetchObis('scientificname=Megaptera%20novaeangliae&size=200&sort=eventDate');
  let bestWhaleGroup = [];
  const wGroups = {};
  whales.forEach(w => {
    const key = w.dataset_id || w.recordedBy || 'unknown';
    if (!wGroups[key]) wGroups[key] = [];
    wGroups[key].push(w);
  });
  for (const k in wGroups) {
    if (wGroups[k].length > bestWhaleGroup.length) bestWhaleGroup = wGroups[k];
  }

  const wTrack = {
    id: "obis-whale-1",
    individualName: "OBIS Humpback",
    species: "Megaptera novaeangliae",
    commonName: "Humpback Whale",
    studyId: 999992,
    studyName: "OBIS Public Observations",
    color: "#0ea5e9",
    animalType: "mammal",
    coordinates: bestWhaleGroup.filter(t=>t.decimalLongitude && t.decimalLatitude).map(t => ({
      longitude: parseFloat(t.decimalLongitude),
      latitude: parseFloat(t.decimalLatitude),
      timestamp: t.eventDate ? new Date(t.eventDate).getTime() : Date.now() - Math.random()*1000000
    })).sort((a,b) => a.timestamp - b.timestamp).slice(-20)
  };
  wTrack.currentPosition = [
    wTrack.coordinates[wTrack.coordinates.length-1].longitude,
    wTrack.coordinates[wTrack.coordinates.length-1].latitude
  ];
  wTrack.tags = ["mammal", "marine", "obis"];

  const path = './src/data/seed-tracks.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  
  // Remove existing obis or mock tracks to avoid duplicates
  const filtered = data.filter(d => !d.id.startsWith('obis-') && !d.id.startsWith('mock-'));
  
  filtered.push(tTrack);
  filtered.push(wTrack);
  
  fs.writeFileSync(path, JSON.stringify(filtered, null, 2));
  console.log("Real OBIS data appended successfully!");
}

main().catch(console.error);
