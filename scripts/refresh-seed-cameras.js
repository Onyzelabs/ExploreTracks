/**
 * Refresh Script: scripts/refresh-seed-cameras.js
 *
 * Fetches the latest 50 live cameras from Vercel's /api/cameras endpoint
 * and saves them to src/data/seed-cameras.json as a fallback snapshot.
 *
 * Run this script whenever you want to update the fallback data:
 *   node scripts/refresh-seed-cameras.js
 *
 * The file is committed to the repository so that future deployments
 * always have a full 50-camera fallback even when the YouTube API quota
 * is exhausted.
 */

const fs = require("fs");
const path = require("path");

const VERCEL_URL = "https://explore-tracks.vercel.app/api/cameras";
const OUTPUT_PATH = path.resolve(__dirname, "../src/data/seed-cameras.json");

async function refresh() {
  console.log(`Fetching from ${VERCEL_URL}...`);
  const res = await fetch(VERCEL_URL);

  if (!res.ok) {
    console.error(`HTTP error: ${res.status}`);
    process.exit(1);
  }

  const json = await res.json();

  if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
    console.error("API returned no cameras. Aborting to avoid overwriting good data.");
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(json.data, null, 2), "utf8");
  console.log(`✅ Saved ${json.data.length} cameras to ${OUTPUT_PATH}`);
}

refresh();
