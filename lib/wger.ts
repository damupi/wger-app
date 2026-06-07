const BASE_URL = process.env.EXPO_PUBLIC_WGER_URL ?? 'http://192.168.0.11:8009';
export const API_TOKEN = process.env.EXPO_PUBLIC_WGER_TOKEN ?? '';

export async function wgerFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Token ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`wger ${res.status}: ${path}`);
  return res.json();
}

interface Paginated<T> {
  count: number;
  next: string | null;
  results: T[];
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExerciseTranslation {
  id: number;
  name: string;
  description: string;
  language: number;
}

export interface ExerciseInfo {
  id: number;
  category: { id: number; name: string };
  images: Array<{ id: number; image: string }>;
  translations: ExerciseTranslation[];
}

export interface Routine {
  id: number;
  name: string;
  description: string;
  is_template: boolean;
}

export interface Day {
  id: number;
  routine: number;
  order: number;
  name: string;
  is_rest: boolean;
}

export interface Slot {
  id: number;
  day: number;
  order: number;
}

export interface SlotEntry {
  id: number;
  slot: number;
  exercise: number;
  order: number;
  comment: string;
  repetition_unit: number;
  weight_unit: number;
}

export interface SlotEntryConfig {
  sets: number;
  reps: number;
  weight: number;
}

// repetition_unit values from /api/v2/setting-repetitionunit/
export const REP_UNIT_LABEL: Record<number, string> = {
  1: 'REPS',
  2: 'FAIL',
  3: 'SECS',
  4: 'MINS',
  5: 'MILES',
  6: 'KM',
  7: 'MAX',
  8: 'MTR',
};

export interface WorkoutSession {
  id: number;
  date: string;
  workout: number;
  duration: string | null;
  notes: string;
}

export interface WorkoutLog {
  id: number;
  exercise: number;
  workout: number;
  reps: number;
  weight: string;
  date: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getEnglishName(info: ExerciseInfo): string {
  const en = info.translations.find((t) => t.language === 2);
  return en?.name ?? info.translations[0]?.name ?? `Exercise ${info.id}`;
}

export function getEnglishDescription(info: ExerciseInfo): string {
  const en = info.translations.find((t) => t.language === 2);
  return en?.description ?? '';
}

// ── API calls ────────────────────────────────────────────────────────────────

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const first = await wgerFetch<Paginated<T>>(path);
  const results = [...first.results];
  const pageSize = first.results.length || 100;
  const totalPages = Math.ceil(first.count / pageSize);

  if (totalPages <= 1) return results;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      wgerFetch<Paginated<T>>(`${path}${path.includes('?') ? '&' : '?'}offset=${(i + 1) * pageSize}&limit=${pageSize}`)
    )
  );
  rest.forEach((page) => results.push(...page.results));
  return results;
}

export async function fetchAllExercises(): Promise<ExerciseInfo[]> {
  return fetchAllPages<ExerciseInfo>('/api/v2/exerciseinfo/?format=json&language=2&limit=100');
}

export async function fetchExerciseInfo(id: number): Promise<ExerciseInfo> {
  return wgerFetch<ExerciseInfo>(`/api/v2/exerciseinfo/${id}/`);
}

export async function fetchRoutines(): Promise<Routine[]> {
  return fetchAllPages<Routine>('/api/v2/routine/?limit=100');
}

export async function fetchDay(dayId: number): Promise<Day> {
  return wgerFetch<Day>(`/api/v2/day/${dayId}/`);
}

export async function fetchRoutineDays(routineId: number): Promise<Day[]> {
  // The /api/v2/day/ endpoint ignores all query filters; fetch all and filter client-side.
  const data = await fetchAllPages<Day>('/api/v2/day/?limit=100');
  return data
    .filter((d) => d.routine === routineId && !d.is_rest)
    .sort((a, b) => a.order - b.order);
}

export async function fetchDaySlots(dayId: number): Promise<Slot[]> {
  const data = await wgerFetch<Paginated<Slot>>(`/api/v2/slot/?day=${dayId}&limit=100`);
  return data.results.sort((a, b) => a.order - b.order);
}

export async function fetchSlotEntries(slotId: number): Promise<SlotEntry[]> {
  const data = await wgerFetch<Paginated<SlotEntry>>(`/api/v2/slot-entry/?slot=${slotId}&limit=100`);
  return data.results.sort((a, b) => a.order - b.order);
}

export async function fetchExerciseConfigs(): Promise<Map<number, SlotEntryConfig>> {
  // All three config endpoints ignore query filters — fetch all and filter client-side.
  interface RawConfig { id: number; slot_entry: number; iteration: number; value: string | number; }
  const [setsData, repsData, weightData] = await Promise.all([
    fetchAllPages<RawConfig>('/api/v2/sets-config/?limit=100'),
    fetchAllPages<RawConfig>('/api/v2/repetitions-config/?limit=100'),
    fetchAllPages<RawConfig>('/api/v2/weight-config/?limit=100'),
  ]);

  const setsLookup = new Map<number, number>();
  const repsLookup = new Map<number, number>();
  const weightLookup = new Map<number, number>();
  for (const c of setsData) if (c.iteration === 1) setsLookup.set(c.slot_entry, Number(c.value));
  for (const c of repsData) if (c.iteration === 1) repsLookup.set(c.slot_entry, Number(c.value));
  for (const c of weightData) if (c.iteration === 1) weightLookup.set(c.slot_entry, Number(c.value));

  const allIds = new Set([
    ...setsData.map((c) => c.slot_entry),
    ...repsData.map((c) => c.slot_entry),
    ...weightData.map((c) => c.slot_entry),
  ]);
  const map = new Map<number, SlotEntryConfig>();
  for (const id of allIds) {
    map.set(id, {
      sets: setsLookup.get(id) ?? 1,
      reps: repsLookup.get(id) ?? 0,
      weight: weightLookup.get(id) ?? 0,
    });
  }
  return map;
}

export async function fetchSessions(): Promise<WorkoutSession[]> {
  return fetchAllPages<WorkoutSession>('/api/v2/workoutsession/?limit=100');
}

export async function fetchSessionLogs(workoutId: number): Promise<WorkoutLog[]> {
  const data = await wgerFetch<Paginated<WorkoutLog>>(`/api/v2/workoutlog/?workout=${workoutId}&limit=100`);
  return data.results;
}

export async function createWorkoutLog(log: {
  exercise: number;
  workout: number;
  reps: number;
  weight: number;
  date: string;
}): Promise<WorkoutLog> {
  return wgerFetch<WorkoutLog>('/api/v2/workoutlog/', {
    method: 'POST',
    body: JSON.stringify({ ...log, weight: String(log.weight) }),
  });
}

export async function createSession(session: {
  workout: number;
  date: string;
  duration?: string;
  notes?: string;
}): Promise<WorkoutSession> {
  return wgerFetch<WorkoutSession>('/api/v2/workoutsession/', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}
