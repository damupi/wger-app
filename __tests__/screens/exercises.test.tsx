import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as wger from '../../lib/wger';

// ── Mock heavy native modules ─────────────────────────────────────────────────
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ exerciseId: '2' }),
  useNavigation: () => ({ setOptions: jest.fn() }),
  Stack: { Screen: () => null },
}));

jest.mock('react-native-render-html', () => {
  const { Text } = require('react-native');
  return ({ source }: { source: { html: string } }) => <Text testID="html-content">{source.html}</Text>;
});

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { MaterialIcons: Icon };
});

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeExercise = (id: number, name: string, category: string): wger.ExerciseInfo => ({
  id,
  category: { id: 1, name: category },
  images: [],
  translations: [{ id, name, description: `<p>About ${name}</p>`, language: 2 }],
});

const FIXTURES: wger.ExerciseInfo[] = [
  makeExercise(1, 'Arnold Press', 'Shoulders'),
  makeExercise(2, 'Bench Press', 'Chest'),
  makeExercise(3, 'Cable Row', 'Back'),
  makeExercise(4, 'Deadlift', 'Back'),
  makeExercise(5, 'Barbell Curl', 'Arms'),
];

async function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // render is async in RNTL v14
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ── Exercises index screen ────────────────────────────────────────────────────

describe('Exercises index screen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.spyOn(wger, 'fetchAllExercises').mockResolvedValue(FIXTURES);
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows loading indicator while fetch is pending', async () => {
    jest.spyOn(wger, 'fetchAllExercises').mockImplementation(() => new Promise(() => {}));
    const ExercisesScreen = require('../../app/(tabs)/exercises/index').default;
    const { getByText } = await renderWithQuery(<ExercisesScreen />);
    expect(getByText(/loading exercises/i)).toBeTruthy();
  });

  it('renders exercise names after loading', async () => {
    const ExercisesScreen = require('../../app/(tabs)/exercises/index').default;
    const { getByText } = await renderWithQuery(<ExercisesScreen />);
    await waitFor(() => {
      expect(getByText('Arnold Press')).toBeTruthy();
      expect(getByText('Bench Press')).toBeTruthy();
    });
  });

  it('renders at least one section header', async () => {
    const ExercisesScreen = require('../../app/(tabs)/exercises/index').default;
    const { getByText } = await renderWithQuery(<ExercisesScreen />);
    await waitFor(() => expect(getByText('A')).toBeTruthy());
  });

  it('filters exercises when search text is entered', async () => {
    const ExercisesScreen = require('../../app/(tabs)/exercises/index').default;
    const { getByText, getByPlaceholderText, queryByText } = await renderWithQuery(<ExercisesScreen />);
    await waitFor(() => getByText('Arnold Press'));

    fireEvent.changeText(getByPlaceholderText(/search exercises/i), 'bench');

    await waitFor(() => {
      expect(getByText('Bench Press')).toBeTruthy();
      expect(queryByText('Arnold Press')).toBeNull();
    });
  });

  it('navigates to exercise detail on row press', async () => {
    const ExercisesScreen = require('../../app/(tabs)/exercises/index').default;
    const { getByText } = await renderWithQuery(<ExercisesScreen />);
    await waitFor(() => getByText('Bench Press'));
    fireEvent.press(getByText('Bench Press'));
    expect(mockPush).toHaveBeenCalledWith('/exercises/2');
  });

  it('shows error state when API fails', async () => {
    jest.spyOn(wger, 'fetchAllExercises').mockRejectedValue(new Error('Network error'));
    const ExercisesScreen = require('../../app/(tabs)/exercises/index').default;
    const { getByText } = await renderWithQuery(<ExercisesScreen />);
    await waitFor(() => expect(getByText(/failed to load exercises/i)).toBeTruthy());
  });
});

// ── Exercise detail screen ────────────────────────────────────────────────────

describe('Exercise detail screen', () => {
  const benchPressFixture = makeExercise(2, 'Bench Press', 'Chest');

  beforeEach(() => {
    jest.spyOn(wger, 'fetchExerciseInfo').mockResolvedValue(benchPressFixture);
  });

  afterEach(() => jest.restoreAllMocks());

  it('renders exercise name after data loads', async () => {
    const DetailScreen = require('../../app/(tabs)/exercises/[exerciseId]').default;
    const { getByText } = await renderWithQuery(<DetailScreen />);
    await waitFor(() => expect(getByText('Bench Press')).toBeTruthy(), { timeout: 3000 });
  });

  it('renders category badge after data loads', async () => {
    const DetailScreen = require('../../app/(tabs)/exercises/[exerciseId]').default;
    const { getByText } = await renderWithQuery(<DetailScreen />);
    await waitFor(() => expect(getByText('Chest')).toBeTruthy(), { timeout: 3000 });
  });
});
