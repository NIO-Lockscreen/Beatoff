# Beat the Odds — Vercel Blob Leaderboard Setup

## 1. Deploy the API project

```bash
cd vercel-api
npm install
npx vercel        # follow prompts → create a new project
```

## 2. Add Blob storage

In your **Vercel Dashboard → your project → Storage** tab:
- Click **Create** next to **Blob**
- Name it anything (e.g. `beat-the-odds-blob`)
- Click **Connect to Project** → select your API project

Vercel will auto-inject `BLOB_READ_WRITE_TOKEN` as an environment variable. That's it — no other config needed.

## 3. Deploy to production

```bash
npx vercel --prod
```

Note your URL, e.g. `https://beat-the-odds-api.vercel.app`

## 4. Point the game at your new API

In your **game's** `.env.local`:

```env
VITE_LEADERBOARD_URL=https://beat-the-odds-api.vercel.app/api/leaderboard
```

Then rebuild:
```bash
npm run build
```

## 5. Migrate old scores from npoint.io (one-time)

```bash
cd vercel-api
VERCEL_API_URL=https://beat-the-odds-api.vercel.app/api/leaderboard node migrate-leaderboard.mjs
```

This pulls all scores from the old npoint.io bin and loads them into Blob. Safe to run again — only higher scores overwrite.

## Local dev

```bash
# Terminal 1 — API
cd vercel-api
npx vercel dev        # runs on http://localhost:3000

# Terminal 2 — Game
cd ..
# .env.local → VITE_LEADERBOARD_URL=http://localhost:3000/api/leaderboard
npm run dev
```

## How it works

The API stores one file `leaderboard.json` in Vercel Blob (public read, token-gated write).  
- **GET /api/leaderboard** → fetches and returns the JSON  
- **POST /api/leaderboard** → merges new scores (only upgrades, never downgrades), saves back  

The leaderboard file URL looks like:  
`https://xxxx.public.blob.vercel-storage.com/leaderboard.json`
