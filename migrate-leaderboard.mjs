#!/usr/bin/env node
/**
 * migrate-leaderboard.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches the current leaderboard from your old npoint.io endpoint and pushes
 * it to your new Vercel API in one shot.
 *
 * Usage:
 *   node migrate-leaderboard.mjs
 *
 * Set these env vars first (or edit the constants below):
 *   NPOINT_URL      - your old npoint.io endpoint (default shown below)
 *   VERCEL_API_URL  - your new Vercel leaderboard endpoint
 */

const NPOINT_URL    = process.env.NPOINT_URL    ?? 'https://api.npoint.io/b190545b7a1821a2daf4';
const VERCEL_API_URL = process.env.VERCEL_API_URL ?? 'https://YOUR_VERCEL_PROJECT.vercel.app/api/leaderboard';

async function run() {
  console.log('📥  Fetching leaderboard from npoint.io...');
  const fetchRes = await fetch(NPOINT_URL);
  if (!fetchRes.ok) {
    throw new Error(`npoint fetch failed: ${fetchRes.status} ${fetchRes.statusText}`);
  }
  const board = await fetchRes.json();
  console.log(`✅  Fetched board with:`);
  console.log(`    purist:   ${board.purist?.length ?? 0} entries`);
  console.log(`    prestige: ${board.prestige?.length ?? 0} entries`);
  console.log(`    rich:     ${board.rich?.length ?? 0} entries`);
  console.log(`    mommy:    ${board.mommy?.length ?? 0} entries`);

  console.log('\n📤  Pushing to Vercel API...');
  const pushRes = await fetch(VERCEL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Send as a raw board dump — the API recognises this and overwrites directly
    body: JSON.stringify(board),
  });

  if (!pushRes.ok) {
    const text = await pushRes.text();
    throw new Error(`Vercel push failed: ${pushRes.status} — ${text}`);
  }

  const result = await pushRes.json();
  console.log('\n🎉  Migration complete! New board:');
  console.log(`    purist:   ${result.purist?.length ?? 0} entries`);
  console.log(`    prestige: ${result.prestige?.length ?? 0} entries`);
  console.log(`    rich:     ${result.rich?.length ?? 0} entries`);
  console.log(`    mommy:    ${result.mommy?.length ?? 0} entries`);
}

run().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
