# Apply Hub

Standalone web app that scrapes live WordPress / web developer job feeds and stores them in your browser.

## Sources

- OnlineJobs.ph
- Indeed (Philippines)
- JobStreet

## Features

- Client-side live scrape (CORS proxies) with optional `/api/search` fallback on Vercel
- Auto-save scraped jobs into `localStorage`
- Optional auto-scrape every 10 minutes
- Apply prep: copy cover letter + open job page
- Works as a static site (`hub/`)

## Run locally

```bash
cd hub
python -m http.server 5173
```

Open http://localhost:5173

## Deploy

GitHub: https://github.com/programerrelaunch/leads-  
Live: https://leads-chi-two.vercel.app
