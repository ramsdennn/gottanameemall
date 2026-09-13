import { env } from 'cloudflare:workers';
import avatars from '@/lib/avatars.json';
import { leaderboardDifficulties, leaderboardRegions, validateSubmission } from '@/lib/leaderboard';
import { parseCursor, readScores, saveScore } from '@/lib/leaderboard-store';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const avatarKeys = new Set(avatars.map(avatar => avatar.key));
const response = (body: unknown, status = 200) => Response.json(body, { status, headers });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = leaderboardRegions.find(r => r.id === url.searchParams.get('category'))?.id;
  const difficulty = leaderboardDifficulties.find(d => d.id === url.searchParams.get('difficulty'))?.id;
  if (!category || !difficulty) return response({ error: 'Choose a valid leaderboard.' }, 400);
  let cursor;
  try { cursor = parseCursor(url.searchParams.get('cursor'), category, difficulty); }
  catch { return response({ error: 'Invalid leaderboard position.' }, 400); }
  try {
    if (!env.DB) throw new Error('D1 binding unavailable');
    return response(await readScores(env.DB, category, difficulty, cursor));
  } catch (error) {
    console.error('Leaderboard read failed', error);
    return response({ error: 'The leaderboard is unavailable. Please try again.' }, 503);
  }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return response({ error: 'Invalid request origin.' }, 403);
  if (Number(request.headers.get('content-length')) > 4096) return response({ error: 'Submission is too large.' }, 413);
  let score;
  try {
    const body = await request.text();
    if (body.length > 4096) return response({ error: 'Submission is too large.' }, 413);
    score = validateSubmission(JSON.parse(body), avatarKeys);
  } catch (error) { return response({ error: error instanceof SyntaxError ? 'Invalid submission.' : error instanceof Error ? error.message : 'Invalid submission.' }, 400); }
  try {
    if (!env.DB) throw new Error('D1 binding unavailable');
    return response(await saveScore(env.DB, score));
  } catch (error) {
    console.error('Leaderboard submission failed', error);
    return response({ error: 'Your score could not be saved. Please try again.' }, 503);
  }
}
