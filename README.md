# Apply Hub

Personal job application tracker for WordPress / web developer openings.

## What it does

- Save job URLs from OnlineJobs.ph, Indeed, and JobStreet
- Auto-detect source + suggest tags from the title
- Store your cover letter locally (preloaded with Ryan's letter)
- **Apply prep**: copies the letter to clipboard and opens the job page
- Track status: Saved → Applied → Replied → Closed

Data stays in your browser (`localStorage`). Nothing is scraped or auto-submitted.

## Quick start (no install)

```bash
cd hub
python -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173).

## Next.js version (optional)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
