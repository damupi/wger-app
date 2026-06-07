// Tests for db module's public API contract.
// We use jest.doMock + jest.resetModules in beforeEach so each test
// gets a fresh db singleton (no stale _db cache between tests).

import type { ActiveSet } from '../../lib/db';

// In-memory store shared by the mock db across a single test
const store: Record<number, any> = {};
let nextId = 1;

const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();

const mockDb = {
  execAsync: mockExecAsync,
  runAsync: mockRunAsync,
  getAllAsync: mockGetAllAsync,
};

// Reset store + mock behaviour before every test, then re-register the mock
// and clear the module cache so lib/db.ts gets a fresh _db singleton.
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[Number(k)]);
  nextId = 1;

  mockExecAsync.mockReset().mockResolvedValue(undefined);

  mockRunAsync.mockReset().mockImplementation(async (sql: string, ...args: any[]) => {
    if (/^INSERT/i.test(sql)) {
      const id = nextId++;
      const [exId, exName, slotOrder, reps, weight, confirmed] = args;
      store[id] = { id, exercise_id: exId, exercise_name: exName, slot_order: slotOrder, reps, weight, confirmed };
      return { lastInsertRowId: id };
    }
    if (/^UPDATE/i.test(sql)) {
      const [reps, weight, confirmed, id] = args;
      if (store[id]) Object.assign(store[id], { reps, weight, confirmed });
      return {};
    }
    if (/^DELETE.*WHERE/i.test(sql)) {
      const [id] = args;
      delete store[id];
      return {};
    }
    return {};
  });

  mockGetAllAsync.mockReset().mockImplementation(async () => Object.values(store));

  jest.resetModules();
  jest.doMock('expo-sqlite', () => ({
    openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
  }));
});

// Helper: load a fresh db module after jest.resetModules()
function loadDb() {
  return require('../../lib/db') as typeof import('../../lib/db');
}

// ── insertActiveSet ───────────────────────────────────────────────────────────

describe('insertActiveSet', () => {
  it('returns a numeric id > 0', async () => {
    const { insertActiveSet } = loadDb();
    const id = await insertActiveSet({ exerciseId: 9, exerciseName: 'Swing', slotOrder: 1, reps: 0, weight: 0, confirmed: false });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('sequential inserts return incrementing ids', async () => {
    const { insertActiveSet } = loadDb();
    const id1 = await insertActiveSet({ exerciseId: 1, exerciseName: 'A', slotOrder: 1, reps: 0, weight: 0, confirmed: false });
    const id2 = await insertActiveSet({ exerciseId: 2, exerciseName: 'B', slotOrder: 2, reps: 0, weight: 0, confirmed: false });
    expect(id2).toBeGreaterThan(id1);
  });
});

// ── updateActiveSet ───────────────────────────────────────────────────────────

describe('updateActiveSet', () => {
  it('updates reps, weight and confirmed', async () => {
    const { insertActiveSet, updateActiveSet, getActiveSets } = loadDb();
    const id = await insertActiveSet({ exerciseId: 9, exerciseName: 'Swing', slotOrder: 1, reps: 0, weight: 0, confirmed: false });
    await updateActiveSet(id, 10, 60, true);
    const sets = await getActiveSets();
    expect(sets.find((s: ActiveSet) => s.id === id)).toMatchObject({ reps: 10, weight: 60, confirmed: true });
  });
});

// ── deleteActiveSet ───────────────────────────────────────────────────────────

describe('deleteActiveSet', () => {
  it('removes the set by id', async () => {
    const { insertActiveSet, deleteActiveSet, getActiveSets } = loadDb();
    const id = await insertActiveSet({ exerciseId: 9, exerciseName: 'Swing', slotOrder: 1, reps: 5, weight: 40, confirmed: true });
    await deleteActiveSet(id);
    expect((await getActiveSets()).find((s: ActiveSet) => s.id === id)).toBeUndefined();
  });
});

// ── clearActiveSets ───────────────────────────────────────────────────────────

describe('clearActiveSets', () => {
  it('calls execAsync with a DELETE statement', async () => {
    const { clearActiveSets } = loadDb();
    await clearActiveSets();
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE'));
  });
});

// ── getActiveSets ─────────────────────────────────────────────────────────────

describe('getActiveSets', () => {
  it('returns [] when store is empty', async () => {
    const { getActiveSets } = loadDb();
    expect(await getActiveSets()).toEqual([]);
  });

  it('maps snake_case db columns to camelCase interface', async () => {
    const { insertActiveSet, getActiveSets } = loadDb();
    await insertActiveSet({ exerciseId: 42, exerciseName: 'Press', slotOrder: 3, reps: 8, weight: 80, confirmed: false });
    const [set] = await getActiveSets();
    expect(set).toMatchObject({ exerciseId: 42, exerciseName: 'Press', slotOrder: 3, reps: 8, weight: 80, confirmed: false });
  });
});
