import * as SQLite from 'expo-sqlite';

export interface ActiveSet {
  id?: number;
  exerciseId: number;
  exerciseName: string;
  slotOrder: number;
  reps: number;
  weight: number;
  confirmed: boolean;
}

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('workout.db');
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS active_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id INTEGER NOT NULL,
        exercise_name TEXT NOT NULL,
        slot_order INTEGER NOT NULL,
        reps INTEGER NOT NULL DEFAULT 0,
        weight REAL NOT NULL DEFAULT 0,
        confirmed INTEGER NOT NULL DEFAULT 0
      );
    `);
  }
  return _db;
}

export async function clearActiveSets(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM active_sets;');
}

export async function insertActiveSet(set: Omit<ActiveSet, 'id'>): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO active_sets (exercise_id, exercise_name, slot_order, reps, weight, confirmed) VALUES (?, ?, ?, ?, ?, ?);',
    set.exerciseId,
    set.exerciseName,
    set.slotOrder,
    set.reps,
    set.weight,
    set.confirmed ? 1 : 0
  );
  return result.lastInsertRowId;
}

export async function updateActiveSet(id: number, reps: number, weight: number, confirmed: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE active_sets SET reps = ?, weight = ?, confirmed = ? WHERE id = ?;',
    reps,
    weight,
    confirmed ? 1 : 0,
    id
  );
}

export async function deleteActiveSet(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM active_sets WHERE id = ?;', id);
}

export async function getActiveSets(): Promise<ActiveSet[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: number;
    exercise_id: number;
    exercise_name: string;
    slot_order: number;
    reps: number;
    weight: number;
    confirmed: number;
  }>('SELECT * FROM active_sets ORDER BY slot_order, id;');
  return rows.map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    slotOrder: r.slot_order,
    reps: r.reps,
    weight: r.weight,
    confirmed: r.confirmed === 1,
  }));
}
