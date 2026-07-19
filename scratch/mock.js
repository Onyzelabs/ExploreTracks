const fs = require('fs');
const path = './src/data/seed-tracks.json';
const data = require('.' + path);

const turtle = {
  "id": "mock-turtle-1",
  "individualName": "Crush",
  "species": "Chelonia mydas",
  "commonName": "Green Sea Turtle",
  "studyId": 5020584004,
  "studyName": "Green Sea Turtle Migration",
  "color": "#10b981",
  "animalType": "reptile",
  "coordinates": [
    { "longitude": -156.4172, "latitude": 20.735, "timestamp": Date.now() - 500000 },
    { "longitude": -156.4172, "latitude": 20.736, "timestamp": Date.now() - 400000 },
    { "longitude": -156.4173, "latitude": 20.737, "timestamp": Date.now() - 300000 },
    { "longitude": -156.4174, "latitude": 20.738, "timestamp": Date.now() - 200000 },
    { "longitude": -156.4175, "latitude": 20.739, "timestamp": Date.now() - 100000 },
    { "longitude": -156.4176, "latitude": 20.740, "timestamp": Date.now() }
  ],
  "currentPosition": [ -156.4176, 20.740 ],
  "tags": [ "reptile", "marine" ]
};

const whale = {
  "id": "mock-whale-1",
  "individualName": "Willy",
  "species": "Megaptera novaeangliae",
  "commonName": "Humpback Whale",
  "studyId": 8287878141,
  "studyName": "Southern Africa Whale Migration",
  "color": "#0ea5e9",
  "animalType": "mammal",
  "coordinates": [
    { "longitude": 18.4232, "latitude": -33.9249, "timestamp": Date.now() - 500000 },
    { "longitude": 18.4222, "latitude": -33.9239, "timestamp": Date.now() - 400000 },
    { "longitude": 18.4212, "latitude": -33.9229, "timestamp": Date.now() - 300000 },
    { "longitude": 18.4202, "latitude": -33.9219, "timestamp": Date.now() - 200000 },
    { "longitude": 18.4192, "latitude": -33.9209, "timestamp": Date.now() - 100000 },
    { "longitude": 18.4182, "latitude": -33.9199, "timestamp": Date.now() }
  ],
  "currentPosition": [ 18.4182, -33.9199 ],
  "tags": [ "mammal", "marine" ]
};

data.push(turtle);
data.push(whale);

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log("Mock data appended successfully!");
