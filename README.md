# 🌍 ExploreTracks

ExploreTracks is an interactive global map platform designed for wildlife enthusiasts. It seamlessly combines **live nature cameras** from [explore.org](https://explore.org) with **real-time animal tracking telemetry** from [Movebank](https://www.movebank.org), allowing you to observe wildlife in real-time across the globe.

## ✨ Features

- **🗺️ Interactive Global Map**: Explore the world using beautifully stylized base maps (powered by MapLibre GL JS & Stadia Maps).
- **📷 Dynamic Video Television Wall**: Open up to **12 concurrent live wildlife streams**! The floating video dock uses a smart responsive grid layout that you can drag and resize freely.
- **🐾 Real-Time Animal Tracks**: View actual 6-month historical GPS movement tracks of various animals (Bears, Eagles, Sea Turtles, Elephants, and more) across the globe.
- **💬 YouTube Danmaku Overlay**: Native integration with the YouTube Live Chat API to display real-time live chat messages as floating "danmaku" across the video players.
- **🗣️ Global Chat Room**: A fully draggable and resizable global chat window to interact with other wildlife watchers on the platform.
- **🔍 Advanced Filtering & Search**: Quickly locate specific cameras or animal tracks by name, location, or species taxonomy.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Map Engine**: [MapLibre GL JS](https://maplibre.org/)
- **Data Sources**: [Movebank REST API](https://www.movebank.org/cms/movebank-content/movebank-api), YouTube Data API v3
- **Window Management**: `react-rnd` for draggable UI elements.

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

### 3. Setup Environment Variables
Create a `.env.local` file in the root directory and add the following keys:

```env
# YouTube Data API v3 Key (for fetching live cameras and chat)
YOUTUBE_API_KEY=your_youtube_api_key

# Movebank Credentials (for fetching animal telemetry data)
MOVEBANK_USERNAME=your_movebank_username
MOVEBANK_PASSWORD=your_movebank_password
MOVEBANK_STUDY_IDS=2911040,21231406,9651291
```

*Note: If Movebank credentials are not provided, the application will gracefully fall back to a curated set of local seed data.*

### 4. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the application running.

## ☁️ Deployment (Vercel)

The easiest way to deploy ExploreTracks is using [Vercel](https://vercel.com).

1. Import your GitHub repository to Vercel.
2. In the deployment settings, add your `.env.local` variables into the **Environment Variables** section. **(Don't forget to click "Add" for each one!)**
3. Click **Deploy**.

Because ExploreTracks utilizes Next.js Server-side API routes to safely proxy the Movebank credentials and YouTube API keys, deploying via Vercel ensures your secrets are never exposed to the client browser.

## 📄 License

This project is open-source. Map data is provided by OpenStreetMap and Stadia Maps. Animal track data is provided by Movebank. Live streams are provided by explore.org.
