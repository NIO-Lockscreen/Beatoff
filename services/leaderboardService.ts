import { GlobalLeaderboard, LeaderboardEntry } from '../types';

// NPOINT CONFIGURATION
// https://www.npoint.io/docs/b190545b7a1821a2daf4
const BIN_ID = 'b190545b7a1821a2daf4'; 
const API_URL = `https://api.npoint.io/${BIN_ID}`;

const LOCAL_STORAGE_KEY = 'beatTheOdds_local_board';

const DEFAULT_BOARD: GlobalLeaderboard = {
  purist: [],
  prestige: [],
  rich: [],
  mommy: []
};

export const LeaderboardService = {
  getLeaderboard: async (): Promise<GlobalLeaderboard> => {
    try {
      // Add cache busting
      const response = await fetch(`${API_URL}?_=${Date.now()}`);
      
      if (!response.ok) {
        console.warn(`Leaderboard fetch failed: ${response.status}`);
        return DEFAULT_BOARD;
      }
      
      const data = await response.json();
      
      // Handle potential null/empty response from fresh bin or malformed data
      if (!data) return DEFAULT_BOARD;

      // Ensure all arrays exist to prevent crashes
      return {
          purist: Array.isArray(data.purist) ? data.purist : [],
          prestige: Array.isArray(data.prestige) ? data.prestige : [],
          rich: Array.isArray(data.rich) ? data.rich : [],
          mommy: Array.isArray(data.mommy) ? data.mommy : []
      };
    } catch (e) {
      console.warn("Leaderboard fetch failed (using local fallback):", e);
      return getLocalBoard();
    }
  },

  submitScore: async (
    category: keyof GlobalLeaderboard, 
    entry: LeaderboardEntry
  ): Promise<GlobalLeaderboard> => {
    try {
        // 1. Get current data (Fetch-Modify-Write pattern)
        // We fetch fresh data to minimize race conditions, then overwrite the bin.
        let currentBoard = await LeaderboardService.getLeaderboard();

        // 2. Update logic
        const list = currentBoard[category] || []; // Safety check
        const existingIndex = list.findIndex(e => e.name === entry.name);
        
        let updated = false;
        if (existingIndex >= 0) {
            // Only update if score is higher
            if (entry.score > list[existingIndex].score) {
                list[existingIndex] = entry;
                updated = true;
            } else if (entry.score === list[existingIndex].score) {
                 // Update metadata like title if score is tied
                 if (entry.title !== list[existingIndex].title) {
                     list[existingIndex] = entry;
                     updated = true;
                 }
            }
        } else {
            // New entry
            list.push(entry);
            updated = true;
        }

        if (!updated) return currentBoard;

        // Sort & Trim to Top 20
        list.sort((a, b) => b.score - a.score);
        currentBoard[category] = list.slice(0, 20);

        // 3. Push to NPoint (POST overwrites the entire JSON content)
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
        return updateLocalBoard(category, entry);
    }
  }
};

// --- Local Storage Fallback Helpers ---

const getLocalBoard = (): GlobalLeaderboard => {
    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        return local ? JSON.parse(local) : DEFAULT_BOARD;
    } catch (e) {
        return DEFAULT_BOARD;
    }
};

const updateLocalBoard = (category: keyof GlobalLeaderboard, entry: LeaderboardEntry): GlobalLeaderboard => {
    const currentBoard = getLocalBoard();
    const list = currentBoard[category] || [];
    const existingIndex = list.findIndex(e => e.name === entry.name);
    
    if (existingIndex >= 0) {
        if (entry.score > list[existingIndex].score) {
            list[existingIndex] = entry;
        }
    } else {
        list.push(entry);
    }
    
    list.sort((a, b) => b.score - a.score);
    currentBoard[category] = list.slice(0, 20);
    
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentBoard));
    } catch (e) {
        console.error("Failed to save local leaderboard", e);
    }
    return currentBoard;
};