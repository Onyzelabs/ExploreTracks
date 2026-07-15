# 🌍 ExploreTracks

ExploreTracks is a **fully responsive** interactive global map platform for wildlife enthusiasts. It combines **live nature cameras** from [explore.org](https://explore.org) with **real-time animal tracking telemetry** from [Movebank](https://www.movebank.org), letting you observe wildlife in real-time across the globe — on any device.

🌐 **Live Demo**: [explore-tracks.vercel.app](https://explore-tracks.vercel.app)

---

## ✨ Features

- **🗺️ Interactive Global Map** — Explore the world with multiple base-map styles (Dark, Voyager, Light, Satellite), powered by MapLibre GL JS & CartoDB.
- **📷 Live Wildlife Cameras** — Up to 50 concurrent live streams from explore.org, automatically geo-located on the map via a title-keyword dictionary.
  - Desktop: draggable, resizable floating video windows (up to 12 open at once).
  - Mobile: full-width bottom tray with tab switching between open cameras.
- **🐾 Real-Time Animal Tracks** — 6-month GPS movement tracks from Movebank (bears, eagles, sea turtles, elephants, sharks, and more).
- **💬 Danmaku Overlay** — YouTube Live Chat messages float across the video as danmaku (toggleable, default off).
- **🗣️ Global Chat Room** — Desktop: draggable resizable floating chat window. Mobile: bottom sheet panel.
- **🔍 Filter & Search** — Filter by camera category or animal type; free-text search by name or location.
- **📱 Fully Responsive (RWD)** — Optimised for phones, tablets, and desktops. Hamburger navigation on mobile.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React Server Components) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Map Engine | [MapLibre GL JS](https://maplibre.org/) |
| Base Maps | [CartoDB](https://carto.com/) (free, no API key required) |
| Live Cameras | YouTube Data API v3 |
| Animal Telemetry | [Movebank REST API](https://www.movebank.org/cms/movebank-content/movebank-api) |
| Floating UI | [react-rnd](https://github.com/bokuweb/react-rnd) |
| Data Fetching | [SWR](https://swr.vercel.app/) |
| Deployment | [Vercel](https://vercel.com) |

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Onyzelabs/ExploreTracks.git
cd ExploreTracks
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```env
# YouTube Data API v3 key (for fetching live cameras and danmaku chat)
YOUTUBE_API_KEY=your_youtube_api_key

# Movebank credentials (for fetching animal telemetry tracks)
MOVEBANK_USERNAME=your_movebank_username
MOVEBANK_PASSWORD=your_movebank_password
MOVEBANK_STUDY_IDS=2911040,21231406,9651291
```

> **Note**: Both services have graceful fallbacks:
> - Without `YOUTUBE_API_KEY` or when the daily quota (100 Search queries) is exhausted, the app falls back to `src/data/seed-cameras.json` — a snapshot of the last successful 50-camera fetch.
> - Without Movebank credentials, the app falls back to 6 curated seed animal tracks.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment (Vercel)

1. Import your GitHub repository to Vercel.
2. In **Project Settings → Environment Variables**, add all keys from your `.env.local`.
3. Click **Deploy**.

Next.js API routes proxy all credentials server-side, so API keys are never exposed to the browser.

---

## 🔧 Maintenance Scripts

### Refresh the camera seed snapshot

When the YouTube API quota resets (midnight PT) and cameras are loading correctly, run this to update the fallback snapshot:

```bash
node scripts/refresh-seed-cameras.js
git add src/data/seed-cameras.json
git commit -m "chore: refresh seed cameras snapshot"
git push
```

---

## 🗄️ API Quota Notes

| Endpoint | Daily Limit | Usage per request |
|---|---|---|
| YouTube Search | 100 queries | 1 query per cache miss (TTL: 60 min) |
| YouTube Videos | 10,000 queries | 1 query per open video (danmaku) |
| Movebank | Rate-limited | Cached for 15 min |

---

## 📄 License

Open-source. Map data © [OpenStreetMap](https://www.openstreetmap.org/) contributors & [CartoDB](https://carto.com/). Animal telemetry © [Movebank](https://www.movebank.org/). Live streams © [explore.org](https://explore.org/).
