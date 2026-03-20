# PH-7-1 Soil Monitoring System

ESP8266-based soil monitoring project with a web dashboard, history views, and API endpoints for sensor data.

## What it does
- Receives sensor readings from ESP8266 devices
- Shows current values in a web dashboard
- Stores reading history
- Provides chart views for trends over time
- Supports data export and basic stats

## Project structure
- `index.html` — current sensor readings
- `charts.html` — historical charts
- `backend.js` — local backend server
- `api/index.js` — serverless entry for Vercel
- `esp8266_firmware.ino` — microcontroller firmware
- `vercel.json` — Vercel config

## Stack
- Node.js / Express
- Vanilla JavaScript
- Chart.js
- ESP8266
- Optional Supabase for persistent storage

## Local run
```bash
npm install
npm start
```

## Deployment
The project can run locally or be deployed to Vercel.

## Why this repo matters
This is a solid hardware + web monitoring project: real sensor input, browser UI, and practical data handling.

## Screenshots
Add 1-3 screenshots in `docs/images/` and embed them like this:

```md
![Overview](docs/images/overview.png)
![Dashboard](docs/images/dashboard.png)
```

