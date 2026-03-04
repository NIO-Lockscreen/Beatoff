import { GlobalLeaderboard, LeaderboardEntry } from '../types';

// =================================================================================================
// LEADERBOARD API CONFIGURATION
// =================================================================================================
// Primary: Your self-hosted Vercel endpoint (set VITE_LEADERBOARD_URL in .env.local)
// Fallback: The old npoint.io shard (read-only fallback if Vercel is unreachable)
// =================================================================================================

const VERCEL_API = import.meta.env.VITE_LEADERBOARD_URL as string | undefined;
export const BACKUP_LEADERBOARD_URL = 'https://api.npoint.io/5c460922a3cce1f11663';

// Use the Vercel API if configured, otherwise fall back to npoint
const API_URL = VERCEL_API ?? 'https://api.npoint.io/b190545b7a1821a2daf4';

const LOCAL_STORAGE_KEY = 'beatTheOdds_local_board';

const DEFAULT_BOARD: GlobalLeaderboard = {
  purist: [],
  prestige: [],
  rich: [],
  mommy: []
};

const getLocalBoard = (): GlobalLeaderboard => {
    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        return local ? JSON.parse(local) : DEFAULT_BOARD;
    } catch (e) {
        return DEFAULT_BOARD;
    }
};

const updateLocalBoardState = (board: GlobalLeaderboard, category: keyof GlobalLeaderboard, entry: LeaderboardEntry): GlobalLeaderboard => {
    const list = board[category] || [];
    const existingIndex = list.findIndex(e => e.name === entry.name);
    if (existingIndex >= 0) {
        if (entry.score > list[existingIndex].score) list[existingIndex] = entry;
    } else {
        list.push(entry);
    }
    list.sort((a, b) => b.score - a.score);
    board[category] = list.slice(0, 20);
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(board)); } catch (e) { console.error(e); }
    return board;
}

let requestQueue: Promise<any> = Promise.resolve();

async function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = requestQueue.then(operation).catch(e => { console.error("Leaderboard queue error:", e); throw e; });
    requestQueue = next.catch(() => {});
    return next;
}

async function fetchBoard(): Promise<GlobalLeaderboard> {
    const response = await fetch(`${API_URL}?_=${Date.now()}`);
    if (!response.ok) throw new Error(`Leaderboard fetch failed: ${response.status}`);
    const data = await response.json();
    if (!data || typeof data !== 'object') return DEFAULT_BOARD;
    return {
        purist: Array.isArray(data.purist) ? data.purist : [],
        prestige: Array.isArray(data.prestige) ? data.prestige : [],
        rich: Array.isArray(data.rich) ? data.rich : [],
        mommy: Array.isArray(data.mommy) ? data.mommy : []
    };
}

async function pushBoard(board: GlobalLeaderboard): Promise<void> {
    await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(board)
    });
}

export const LeaderboardService = {
  _fetchStrict: fetchBoard,

  getLeaderboard: async (): Promise<GlobalLeaderboard> => {
    try { return await fetchBoard(); }
    catch (e) { console.warn("Leaderboard fetch failed (using local fallback):", e); return getLocalBoard(); }
  },

  submitScore: async (category: keyof GlobalLeaderboard, entry: LeaderboardEntry): Promise<GlobalLeaderboard> => {
      return LeaderboardService.submitScores([{ category, entry }]);
  },

  submitScores: async (updates: { category: keyof GlobalLeaderboard, entry: LeaderboardEntry }[]): Promise<GlobalLeaderboard> => {
      return enqueue(async () => {
        try {
            let currentBoard = await fetchBoard();
            let hasChanges = false;
            
            for (const { category, entry } of updates) {
                const list = currentBoard[category] || [];
                const existingIndex = list.findIndex(e => e.name === entry.name);
                if (existingIndex >= 0) {
                    if (entry.score > list[existingIndex].score || (entry.score === list[existingIndex].score && entry.title !== list[existingIndex].title)) {
                        list[existingIndex] = entry;
                        hasChanges = true;
                    }
                } else {
                    list.push(entry);
                    hasChanges = true;
                }
                if (hasChanges) {
                    list.sort((a, b) => b.score - a.score);
                    currentBoard[category] = list.slice(0, 20);
                }
            }

            if (!hasChanges) return currentBoard;
            await pushBoard(currentBoard);
            return currentBoard;
        } catch (e) {
            console.error("Leaderboard submit failed (using local fallback):", e);
            let localBoard = getLocalBoard();
            for (const update of updates) localBoard = updateLocalBoardState(localBoard, update.category, update.entry);
            return localBoard;
        }
      });
  },

  wipeCheaters: async (): Promise<void> => {
      return enqueue(async () => {
          try {
              const currentBoard = await fetchBoard();
              let hasChanges = false;
              (['purist', 'prestige', 'rich', 'mommy'] as const).forEach(cat => {
                  const filtered = currentBoard[cat].filter(e => e.name.toLowerCase() !== 'cheater');
                  if (filtered.length !== currentBoard[cat].length) { currentBoard[cat] = filtered; hasChanges = true; }
              });
              if (hasChanges) await pushBoard(currentBoard);
          } catch (e) { console.error("Failed to wipe cheaters", e); }
      });
  }
};
