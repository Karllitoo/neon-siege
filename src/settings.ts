export interface Settings {
  master: number;
  music: number;
  effects: number;
  sensitivity: number;
  fov: number;
  quality: 'low' | 'medium' | 'high';
  shake: number;
  numbers: boolean;
  reduced: boolean;
  invert: boolean;
}
export const defaults: Settings = {
  master: 0.65,
  music: 0.25,
  effects: 0.8,
  sensitivity: 1,
  fov: 80,
  quality: 'high',
  shake: 0.35,
  numbers: true,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  invert: false,
};
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function loadSettings(): Settings {
  const stored = readStorage<unknown>('neon-siege-settings', {});
  const raw = stored && typeof stored === 'object' ? (stored as Partial<Settings>) : {},
    result = { ...defaults };
  for (const key of ['master', 'music', 'effects', 'shake'] as const)
    if (typeof raw[key] === 'number') result[key] = Math.max(0, Math.min(1, raw[key]!));
  for (const key of ['numbers', 'reduced', 'invert'] as const)
    if (typeof raw[key] === 'boolean') result[key] = raw[key]!;
  if (typeof raw.sensitivity === 'number')
    result.sensitivity = Math.max(0.2, Math.min(3, raw.sensitivity));
  if (typeof raw.fov === 'number') result.fov = Math.max(60, Math.min(110, raw.fov));
  if (['low', 'medium', 'high'].includes(raw.quality ?? '')) result.quality = raw.quality!;
  return result;
}
