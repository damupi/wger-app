import {
  getEnglishName,
  getEnglishDescription,
  fetchAllExercises,
  fetchExerciseInfo,
  wgerFetch,
  API_TOKEN,
  ExerciseInfo,
} from '../../lib/wger';

// ── getEnglishName ────────────────────────────────────────────────────────────

describe('getEnglishName', () => {
  const base: ExerciseInfo = {
    id: 9,
    category: { id: 10, name: 'Abs' },
    images: [],
    translations: [],
  };

  it('returns English translation when language=2 exists', () => {
    const info: ExerciseInfo = {
      ...base,
      translations: [
        { id: 1, name: 'Balancé', description: '', language: 3 },
        { id: 2, name: '2 Handed Kettlebell Swing', description: '', language: 2 },
      ],
    };
    expect(getEnglishName(info)).toBe('2 Handed Kettlebell Swing');
  });

  it('falls back to first translation when no language=2', () => {
    const info: ExerciseInfo = {
      ...base,
      translations: [{ id: 1, name: 'Kniebeuge', description: '', language: 5 }],
    };
    expect(getEnglishName(info)).toBe('Kniebeuge');
  });

  it('returns placeholder when no translations exist', () => {
    expect(getEnglishName(base)).toBe('Exercise 9');
  });
});

// ── getEnglishDescription ─────────────────────────────────────────────────────

describe('getEnglishDescription', () => {
  const base: ExerciseInfo = {
    id: 1,
    category: { id: 8, name: 'Arms' },
    images: [],
    translations: [],
  };

  it('returns English description', () => {
    const info: ExerciseInfo = {
      ...base,
      translations: [
        { id: 1, name: 'Curl', description: '<p>Bicep curl</p>', language: 2 },
      ],
    };
    expect(getEnglishDescription(info)).toBe('<p>Bicep curl</p>');
  });

  it('returns empty string when no translations', () => {
    expect(getEnglishDescription(base)).toBe('');
  });

  it('returns empty string when language=2 not found', () => {
    const info: ExerciseInfo = {
      ...base,
      translations: [{ id: 1, name: 'X', description: 'desc', language: 5 }],
    };
    expect(getEnglishDescription(info)).toBe('');
  });
});

// ── wgerFetch (network) ───────────────────────────────────────────────────────

describe('wgerFetch', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    });
    await expect(wgerFetch('/api/v2/routine/')).rejects.toThrow('wger 401');
  });

  it('returns parsed JSON on success', async () => {
    const payload = { count: 1, results: [{ id: 1, name: 'My Workout' }] };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => payload });
    const result = await wgerFetch('/api/v2/routine/');
    expect(result).toEqual(payload);
  });

  it('sets Authorization header with token', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    await wgerFetch('/api/v2/routine/');
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: `Token ${API_TOKEN}`,
    });
  });
});

// ── fetchAllExercises (pagination) ────────────────────────────────────────────

const makeExercisePage = (ids: number[], count: number) => ({
  ok: true,
  json: async () => ({
    count,
    next: null,
    results: ids.map((id) => ({
      id,
      category: { id: 10, name: 'Abs' },
      images: [],
      translations: [{ id, name: `Ex ${id}`, description: '', language: 2 }],
    })),
  }),
});

describe('fetchAllExercises pagination', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => jest.restoreAllMocks());

  it('fetches only one page when count <= limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(makeExercisePage([1, 2, 3], 3));
    const result = await fetchAllExercises();
    expect(result).toHaveLength(3);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('fetches multiple pages when count > page size', async () => {
    const page1Ids = Array.from({ length: 3 }, (_, i) => i + 1);
    const page2Ids = Array.from({ length: 3 }, (_, i) => i + 4);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 6,
          next: 'http://next',
          results: page1Ids.map((id) => ({
            id,
            category: { id: 10, name: 'Abs' },
            images: [],
            translations: [{ id, name: `Ex ${id}`, description: '', language: 2 }],
          })),
        }),
      })
      .mockResolvedValueOnce(makeExercisePage(page2Ids, 6));

    const result = await fetchAllExercises();
    expect(result).toHaveLength(6);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
  });
});
