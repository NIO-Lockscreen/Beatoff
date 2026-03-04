import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, head } from '@vercel/blob';

interface LeaderboardEntry {
  name: string;
  score: number;
  date: number;
  title?: string;
}

interface GlobalLeaderboard {
  purist: LeaderboardEntry[];
  prestige: LeaderboardEntry[];
  rich: LeaderboardEntry[];
  mommy: LeaderboardEntry[];
}

const BLOB_FILENAME = 'leaderboard.json';
const DEFAULT_BOARD: GlobalLeaderboard = { purist: [], prestige: [], rich: [], mommy: [] };

async function readBoard(): Promise<GlobalLeaderboard> {
  try {
    const meta = await head(BLOB_FILENAME, { token: process.env.BLOB_READ_WRITE_TOKEN! });
    // Private blob — must authenticate the fetch with the token
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
  } catch {
    return DEFAULT_BOARD;
  }
}

async function writeBoard(board: GlobalLeaderboard): Promise<void> {
  await put(BLOB_FILENAME, JSON.stringify(board), {
    access: 'private',
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    addRandomSuffix: false,
  });
}

function applyUpdates(
  board: GlobalLeaderboard,
  updates: { category: keyof GlobalLeaderboard; entry: LeaderboardEntry }[]
): { board: GlobalLeaderboard; changed: boolean } {
  let changed = false;
  for (const { category, entry } of updates) {
    const list = board[category] ?? [];
    const idx = list.findIndex((e) => e.name === entry.name);
    if (idx >= 0) {
      if (entry.score > list[idx].score || (entry.score === list[idx].score && entry.title !== list[idx].title)) {
        list[idx] = entry;
        changed = true;
      }
    } else {
      list.push(entry);
      changed = true;
    }
    list.sort((a, b) => b.score - a.score);
    board[category] = list.slice(0, 20);
  }
  return { board, changed };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowed = process.env.ALLOWED_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const board = await readBoard();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(board);
  }

  if (req.method === 'POST') {
    const body = req.body as Record<string, unknown>;
    let board = await readBoard();

    if (!body['updates'] && (body['purist'] || body['prestige'] || body['rich'] || body['mommy'])) {
      const merged: GlobalLeaderboard = {
        purist:   Array.isArray(body['purist'])   ? body['purist']   as LeaderboardEntry[] : board.purist,
        prestige: Array.isArray(body['prestige']) ? body['prestige'] as LeaderboardEntry[] : board.prestige,
        rich:     Array.isArray(body['rich'])     ? body['rich']     as LeaderboardEntry[] : board.rich,
        mommy:    Array.isArray(body['mommy'])    ? body['mommy']    as LeaderboardEntry[] : board.mommy,
      };
      await writeBoard(merged);
      return res.status(200).json(merged);
    }

    const updates = body['updates'];
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const { board: newBoard, changed } = applyUpdates(board, updates as { category: keyof GlobalLeaderboard; entry: LeaderboardEntry }[]);
    if (changed) await writeBoard(newBoard);
    return res.status(200).json(newBoard);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
