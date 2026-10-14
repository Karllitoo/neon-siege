import type { Difficulty } from './config';
import { readStorage, writeStorage } from './settings';
export interface RecordEntry {
  score: number;
  wave: number;
  difficulty: Difficulty;
  date: string;
}
export function records(): RecordEntry[] {
  const data = readStorage<unknown>('neon-siege-records', []);
  return (Array.isArray(data) ? data : [])
    .filter(
      (r): r is RecordEntry =>
        !!r &&
        typeof r === 'object' &&
        'score' in r &&
        Number.isFinite(r.score) &&
        'wave' in r &&
        Number.isFinite(r.wave) &&
        'date' in r &&
        typeof r.date === 'string' &&
        Number.isFinite(Date.parse(r.date)) &&
        'difficulty' in r &&
        ['rookie', 'operative', 'nightmare'].includes(String(r.difficulty)),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
export function saveRecord(entry: RecordEntry) {
  const old = records();
  const best = entry.score > (old[0]?.score ?? 0);
  const previousWave = highestWave();
  const waveSaved =
    entry.wave > (previousWave?.wave ?? -1) ? writeStorage('neon-siege-highest-wave', entry) : true;
  const saved = writeStorage(
    'neon-siege-records',
    [...old, entry].sort((a, b) => b.score - a.score).slice(0, 10),
  );
  return { best, saved: saved && waveSaved };
}

export function highestWave(): RecordEntry | undefined {
  const stored = readStorage<RecordEntry | null>('neon-siege-highest-wave', null);
  const valid =
    stored &&
    Number.isFinite(stored.wave) &&
    typeof stored.date === 'string' &&
    ['rookie', 'operative', 'nightmare'].includes(stored.difficulty);
  return valid
    ? stored
    : records().reduce<RecordEntry | undefined>(
        (best, r) => (!best || r.wave > best.wave ? r : best),
        undefined,
      );
}
