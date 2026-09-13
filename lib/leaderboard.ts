import type { Difficulty } from './game';

export const leaderboardRegions = [
  { id: 'kanto', label: 'Kanto', total: 151 },
  { id: 'kanto-johto', label: 'Kanto + Johto', total: 251 },
  { id: 'kanto-johto-hoenn', label: 'Kanto + Johto + Hoenn', total: 386 },
] as const;
export type RegionCategory = typeof leaderboardRegions[number]['id'];
export const leaderboardDifficulties: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' }, { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' }, { id: 'very-hard', label: 'Very hard' },
];
export function leaderboardCategory(ids: number[]): RegionCategory | null {
  const key = [...ids].sort((a, b) => a - b).join(',');
  return key === '1' ? 'kanto' : key === '1,2' ? 'kanto-johto' : key === '1,2,3' ? 'kanto-johto-hoenn' : null;
}
export type Avatar = { key: string; id: number; name: string; animated: string; still: string };
export type LeaderboardEntry = { id: number; rank: number; name: string; avatar: string; correct: number; elapsedMs: number; submittedAt: number };
export type LeaderboardPage = { entries: LeaderboardEntry[]; nextCursor: string | null; total: number };
export type SubmissionResult = { accepted: boolean; entryId: number | null; rank: number | null };
export type ScoreSubmission = { runId: string; category: RegionCategory; difficulty: Difficulty; name: string; avatar: string; correct: number; elapsedMs: number; status: 'complete' | 'gave-up' };

export function validateSubmission(value: unknown, avatarKeys: ReadonlySet<string>): ScoreSubmission {
  if (!value || typeof value !== 'object') throw new Error('Invalid submission.');
  const data = value as Record<string, unknown>;
  const region = leaderboardRegions.find(region => region.id === data.category);
  if (!region || !leaderboardDifficulties.some(d => d.id === data.difficulty)) throw new Error('Choose a valid leaderboard.');
  if (typeof data.runId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.runId)) throw new Error('Invalid run.');
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || [...name].length > 10 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new Error('Enter a name of 1–10 characters.');
  if (typeof data.avatar !== 'string' || !avatarKeys.has(data.avatar)) throw new Error('Choose a valid Pokémon avatar.');
  if (typeof data.correct !== 'number' || !Number.isInteger(data.correct) || data.correct < 0 || data.correct > region.total) throw new Error('Invalid Pokémon count.');
  if (typeof data.elapsedMs !== 'number' || !Number.isSafeInteger(data.elapsedMs) || data.elapsedMs < 0) throw new Error('Invalid elapsed time.');
  if (data.status !== 'complete' && data.status !== 'gave-up') throw new Error('Finish your run before submitting.');
  if (data.status === 'complete' && data.correct !== region.total) throw new Error('A completed Pokédex must contain every Pokémon.');
  if (data.correct === 0 && data.elapsedMs !== 0) throw new Error('A run with no correct answers has no elapsed time.');
  return { ...data, name } as ScoreSubmission;
}
