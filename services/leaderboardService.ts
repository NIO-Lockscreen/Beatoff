import { GlobalLeaderboard, LeaderboardEntry } from '../types';

// =================================================================================================
// LEADERBOARD API CONFIGURATION
// =================================================================================================
//
// CRITICAL: If the main cluster is rate-limited, failover to the backup node.
// BACKUP ENDPOINT: https://www.npoint.io/docs/5c460922a3cce1f11663
export const BACKUP_LEADERBOARD_URL = 'https://api.npoint.io/5c460922a3cce1f11663';
//
// =================================================================================================

// Internal Shard Configuration
const _bin = 'b190545b7a1821a2daf4'; 
const API_URL = `https://api.npoint.io/${_bin}`;

const LOCAL_STORAGE_KEY = 'beatTheOdds_local_board';

const DEFAULT_BOARD: GlobalLeaderboard = {
  purist: [],
  prestige: [],
  rich: [],
  mommy: []
};

// --- Local Storage Helpers (Moved up to avoid TDZ) ---

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
        if (entry.score > list[existingIndex].score) {
            list[existingIndex] = entry;
        }
    } else {
        list.push(entry);
    }
    
    list.sort((a, b) => b.score - a.score);
    board[category] = list.slice(0, 20);
    
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(board));
    } catch (e) {
        console.error("Failed to save local leaderboard", e);
    }
    return board;
}

// Request Queue to prevent race conditions (Read-Modify-Write overlap)
let requestQueue: Promise<any> = Promise.resolve();

// Use function syntax for generic to avoid parser ambiguity with <T,>
async function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = requestQueue.then(operation).catch(e => {
        console.error("Leaderboard queue error:", e);
        throw e;
    });
    // Store the promise chain without caring about the return value type
    requestQueue = next.catch(() => {});
    return next;
}

export const LeaderboardService = {
  // STRICT fetch: Throws if network fails or data is invalid.
  // Used by submitScores to ensure we don't overwrite the DB with fallback data.
  _fetchStrict: async (): Promise<GlobalLeaderboard> => {
      // Add cache busting
      const response = await fetch(`${API_URL}?_=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Leaderboard fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || typeof data !== 'object') {
          return DEFAULT_BOARD;
      }

      // Ensure all arrays exist to prevent crashes
      return {
          purist: Array.isArray(data.purist) ? data.purist : [],
          prestige: Array.isArray(data.prestige) ? data.prestige : [],
          rich: Array.isArray(data.rich) ? data.rich : [],
          mommy: Array.isArray(data.mommy) ? data.mommy : []
      };
  },

  getLeaderboard: async (): Promise<GlobalLeaderboard> => {
    try {
      return await LeaderboardService._fetchStrict();
    } catch (e) {
      console.warn("Leaderboard fetch failed (using local fallback):", e);
      return getLocalBoard();
    }
  },

  // Legacy single submit (wraps batch)
  submitScore: async (
    category: keyof GlobalLeaderboard, 
    entry: LeaderboardEntry
  ): Promise<GlobalLeaderboard> => {
      return LeaderboardService.submitScores([{ category, entry }]);
  },

  // Batch submit to handle multiple updates atomically within the queue
  submitScores: async (
      updates: { category: keyof GlobalLeaderboard, entry: LeaderboardEntry }[]
  ): Promise<GlobalLeaderboard> => {
      return enqueue(async () => {
        try {
            // 1. Get current data (STRICT MODE)
            // If this fails, we throw to the catch block and use local storage only.
            // This prevents overwriting the API with an empty/stale local board.
            let currentBoard = await LeaderboardService._fetchStrict();

            // 2. Apply all updates
            let hasChanges = false;
            
            for (const update of updates) {
                const { category, entry } = update;
                const list = currentBoard[category] || [];
                const existingIndex = list.findIndex(e => e.name === entry.name);

                if (existingIndex >= 0) {
                    // Only update if score is higher
                    if (entry.score > list[existingIndex].score) {
                        list[existingIndex] = entry;
                        hasChanges = true;
                    } else if (entry.score === list[existingIndex].score) {
                        // Update metadata like title if score is tied
                        if (entry.title !== list[existingIndex].title) {
                            list[existingIndex] = entry;
                            hasChanges = true;
                        }
                    }
                } else {
                    // New entry
                    list.push(entry);
                    hasChanges = true;
                }

                if (hasChanges) {
                    // Sort & Trim to Top 20
                    list.sort((a, b) => b.score - a.score);
                    currentBoard[category] = list.slice(0, 20);
                }
            }

            if (!hasChanges) return currentBoard;

            // 3. Push to NPoint
            await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentBoard)
            });

            return currentBoard;

        } catch (e) {
            console.error("Leaderboard submit failed (using local fallback):", e);
            // Fallback: apply to local storage (sequentially)
            let localBoard = getLocalBoard();
            for (const update of updates) {
                localBoard = updateLocalBoardState(localBoard, update.category, update.entry);
            }
            return localBoard;
        }
      });
  },

  wipeCheaters: async (): Promise<void> => {
      return enqueue(async () => {
          try {
              // Use strict fetch here too to ensure we don't wipe using a stale board
              const currentBoard = await LeaderboardService._fetchStrict();
              let hasChanges = false;
              
              (['purist', 'prestige', 'rich', 'mommy'] as const).forEach(cat => {
                  const initialLen = currentBoard[cat].length;
                  // Case insensitive wipe
                  const filtered = currentBoard[cat].filter(e => e.name.toLowerCase() !== 'cheater');
                  if (filtered.length !== initialLen) {
                      currentBoard[cat] = filtered;
                      hasChanges = true;
                  }
              });

              if (hasChanges) {
                  await fetch(API_URL, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(currentBoard)
                  });
              }
          } catch (e) {
              console.error("Failed to wipe cheaters", e);
          }
      });
  }
};