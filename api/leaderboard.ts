import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, head } from '@vercel/blob';

// ----- Types -----
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

// We always store the leaderboard at this fixed path in Blob
const BLOB_FILENAME = 'leaderboard.json';

const DEFAULT_BOARD: GlobalLeaderboard = {
  purist: [],
  prestige: [],
  rich: [],
  mommy: [],
};

// ── Blob helpers ─────────────────────────────────────────────────────────────

async function readBoard(): Promise<GlobalLeaderboard> {
  try {
    const meta = await head(BLOB_FILENAME, { token: process.env.BLOB_READ_WRITE_TOKEN! });
    const res = await fetch(meta.url);
    if (!res.ok) return DEFAULT_BOARD;
    const data = await res.json();
    return {
      purist:   Array.isArray(data.purist)   ? data.purist   : [],
      prestige: Array.isArray(data.prestige) ? data.prestige : [],
      rich:     Array.isArray(data.rich)     ? data.rich     : [],
      mommy:    Array.isArray(data.mommy)    ? data.mommy    : [],
    };
  } catch {
    // File doesn't exist yet — return empty board
    return DEFAULT_BOARD;
  }
}

async function writeBoard(board: GlobalLeaderboard): Promise<void> {
  await put(BLOB_FILENAME, JSON.stringify(board), {
    access: 'public',
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    addRandomSuffix: false,   // keeps filename stable so we always overwrite
  });
}

// ── Score merge logic ─────────────────────────────────────────────────────────

function applyUpdates(
  board: GlobalLeaderboard,
  updates: { category: keyof GlobalLeaderboard; entry: LeaderboardEntry }[]
): { board: GlobalLeaderboard; changed: boolean } {
  let changed = false;

  for (const { category, entry } of updates) {
    const list = board[category] ?? [];
    const idx = list.findIndex((e) => e.name === entry.name);

    if (idx >= 0) {
      if (
        entry.score > list[idx].score ||
        (entry.score === list[idx].score && entry.title !== list[idx].title)
      ) {
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

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowed = process.env.ALLOWED_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const board = await readBoard();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(board);
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body as any;
    let board = await readBoard();

    // Migration path: raw board dump from migrate-leaderboard.mjs
    if (!body.updates && (body.purist || body.prestige || body.rich || body.mommy)) {
      const merged: GlobalLeaderboard = {
        purist:   Array.isArray(body.purist)   ? body.purist   : board.purist,
        prestige: Array.isArray(body.prestige) ? body.prestige : board.prestige,
        rich:     Array.isArray(body.rich)     ? body.rich     : board.rich,
        mommy:    Array.isArray(body.mommy)    ? body.mommy    : board.mommy,
      };
      await writeBoard(merged);
      return res.status(200).json(merged);
    }

    // Normal score submit path
    const updates = body.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const { board: newBoard, changed } = applyUpdates(board, updates);
    if (changed) await writeBoard(newBoard);

    return res.status(200).json(newBoard);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
