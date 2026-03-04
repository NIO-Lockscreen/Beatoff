import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, head } from '@vercel/blob';

const NPOINT_URL = 'https://api.npoint.io/b190545b7a1821a2daf4';
const BLOB_FILENAME = 'leaderboard.json';

interface LeaderboardEntry { name: string; score: number; date: number; title?: string; }
interface GlobalLeaderboard { purist: LeaderboardEntry[]; prestige: LeaderboardEntry[]; rich: LeaderboardEntry[]; mommy: LeaderboardEntry[]; }

const DEFAULT_BOARD: GlobalLeaderboard = { purist: [], prestige: [], rich: [], mommy: [] };

async function readBoard(): Promise<GlobalLeaderboard> {
  try {
    const meta = await head(BLOB_FILENAME, { token: process.env.BLOB_READ_WRITE_TOKEN! });
    const res = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN!}` }
    });
    if (!res.ok) return DEFAULT_BOARD;
    const data = await res.json() as Record<string, unknown>;
    return {
      purist:   Array.isArray(data['purist'])   ? data['purist']   as LeaderboardEntry[] : [],
      prestige: Array.isArray(data['prestige']) ? data['prestige'] as LeaderboardEntry[] : [],
      rich:     Array.isArray(data['rich'])     ? data['rich']     as LeaderboardEntry[] : [],
      mommy:    Array.isArray(data['mommy'])    ? data['mommy']    as LeaderboardEntry[] : [],
    };
  } catch { return DEFAULT_BOARD; }
}

async function writeBoard(board: GlobalLeaderboard): Promise<void> {
  await put(BLOB_FILENAME, JSON.stringify(board), {
    access: 'private',
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    addRandomSuffix: false,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.query['secret'] as string;
  if (secret !== process.env.MIGRATE_SECRET) {
    return res.status(401).send('<h2>❌ Wrong or missing secret. Add ?secret=YOUR_SECRET to the URL.</h2>');
  }

  res.setHeader('Content-Type', 'text/html');

  try {
    const nRes = await fetch(NPOINT_URL);
    if (!nRes.ok) throw new Error(`npoint fetch failed: ${nRes.status}`);
    const nData = await nRes.json() as Record<string, unknown>;

    const incoming: GlobalLeaderboard = {
      purist:   Array.isArray(nData['purist'])   ? nData['purist']   as LeaderboardEntry[] : [],
      prestige: Array.isArray(nData['prestige']) ? nData['prestige'] as LeaderboardEntry[] : [],
      rich:     Array.isArray(nData['rich'])     ? nData['rich']     as LeaderboardEntry[] : [],
      mommy:    Array.isArray(nData['mommy'])    ? nData['mommy']    as LeaderboardEntry[] : [],
    };

    const existing = await readBoard();
    const merged: GlobalLeaderboard = {
      purist: [...existing.purist], prestige: [...existing.prestige],
      rich: [...existing.rich], mommy: [...existing.mommy],
    };

    for (const cat of ['purist', 'prestige', 'rich', 'mommy'] as const) {
      for (const entry of incoming[cat]) {
        const idx = merged[cat].findIndex(e => e.name === entry.name);
        if (idx >= 0) { if (entry.score > merged[cat][idx].score) merged[cat][idx] = entry; }
        else { merged[cat].push(entry); }
      }
      merged[cat].sort((a, b) => b.score - a.score);
      merged[cat] = merged[cat].slice(0, 20);
    }

    await writeBoard(merged);

    const html = `<!DOCTYPE html><html><head><title>Migration Complete</title>
<style>body{font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:40px;max-width:600px;margin:auto;}
h1{color:#f59e0b;}table{width:100%;border-collapse:collapse;margin-top:20px;}
td,th{padding:8px 12px;border:1px solid #333;text-align:left;}th{color:#f59e0b;}
.ok{color:#4ade80;}.warn{color:#f59e0b;}</style></head><body>
<h1>✅ Migration Complete!</h1>
<p>Old npoint.io scores merged into Vercel Blob.</p>
<table><tr><th>Category</th><th>Entries</th></tr>
<tr><td>Purist</td><td class="ok">${merged.purist.length}</td></tr>
<tr><td>Prestige</td><td class="ok">${merged.prestige.length}</td></tr>
<tr><td>Rich</td><td class="ok">${merged.rich.length}</td></tr>
<tr><td>Mommy</td><td class="ok">${merged.mommy.length}</td></tr>
</table>
<p class="warn" style="margin-top:30px;">⚠️ You can now delete <code>/api/migrate.ts</code> from GitHub.</p>
</body></html>`;
    return res.status(200).send(html);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).send(`<h2>❌ Migration failed: ${msg}</h2>`);
  }
}
