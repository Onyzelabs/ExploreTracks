const fs = require('fs');
const https = require('https');

const USERNAME = process.env.MOVEBANK_USERNAME || 'hsujoyao';
const PASSWORD = process.env.MOVEBANK_PASSWORD || 'margi123';
const auth = 'Basic ' + Buffer.from(USERNAME + ':' + PASSWORD).toString('base64');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: auth } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i+1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const lines = fs.readFileSync('D:\\Share\\GitHub\\ExploreTracks\\studies.csv', 'utf8').split('\n');
  const headers = parseCsvLine(lines[0]);
  const suspendIdx = headers.indexOf('suspend_license_terms');
  const taxonIdx = headers.indexOf('taxon_ids');
  const idIdx = headers.indexOf('id');
  const nameIdx = headers.indexOf('name');
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const v = parseCsvLine(lines[i]);
    if (v[suspendIdx] === 'true' && v[taxonIdx] && (v[taxonIdx].toLowerCase().includes('chelonia') || v[taxonIdx].toLowerCase().includes('caretta'))) {
        const id = v[idIdx];
        const name = v[nameIdx];
        console.log(`\nTesting Turtle ${id} - ${name.substring(0, 50)}...`);
        const evtUrl = `https://www.movebank.org/movebank/service/direct-read?entity_type=event&study_id=${id}&max_events_per_individual=10`;
        const evtRes = await makeRequest(evtUrl);
        if (evtRes.status === 200 && evtRes.data.includes('location_lat')) {
            console.log(`  SUCCESS! Study ${id} has public tracks!`);
        } else {
            console.log(`  Failed. Status: ${evtRes.status}`);
        }
    }
  }
}
main().catch(console.error);
