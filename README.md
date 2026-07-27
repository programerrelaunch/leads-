# Apply Hub

Personal job application tracker for WordPress / web developer openings.

## What it does

- **Auto search** active WordPress / web developer posts from OnlineJobs.ph, Indeed, and JobStreet
- Optional auto-refresh every 10 minutes
- Save results or **Apply prep** (copies cover letter + opens the job page)
- Manual URL add still available
- Track status: Saved → Applied → Replied → Closed

Search runs through `/api/search` (Vercel serverless). Application submit still happens on the job site itself.

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
