import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as wger from '../../lib/wger';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ routineId: '1' }),
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { MaterialIcons: ({ name }: any) => <Text>{name}</Text> };
});

jest.mock('../../lib/db', () => ({
  clearActiveSets: jest.fn().mockResolvedValue(undefined),
  insertActiveSet: jest.fn().mockResolvedValue(1),
  updateActiveSet: jest.fn().mockResolvedValue(undefined),
  deleteActiveSet: jest.fn().mockResolvedValue(undefined),
  getActiveSets: jest.fn().mockResolvedValue([]),
}));

const ROUTINES: wger.Routine[] = [
  { id: 1, name: 'My Workout', description: '', is_template: false },
];
const TEMPLATES: wger.Routine[] = [
  { id: 2, name: 'Push Template', description: '', is_template: true },
];

async function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// ── Workout index screen ──────────────────────────────────────────────────────

describe('Start Workout screen (index)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.spyOn(wger, 'fetchSessions').mockResolvedValue([]);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows templates under My Templates and routines under My Routines', async () => {
    jest.spyOn(wger, 'fetchRoutines').mockResolvedValue([...TEMPLATES, ...ROUTINES]);
    const Screen = require('../../app/(tabs)/start-workout/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => {
      expect(getByText('My Templates')).toBeTruthy();
      expect(getByText('Push Template')).toBeTruthy();
      expect(getByText('My Routines')).toBeTruthy();
      expect(getByText('My Workout')).toBeTruthy();
    });
  });

  it('navigates to routine detail on card press', async () => {
    jest.spyOn(wger, 'fetchRoutines').mockResolvedValue(ROUTINES);
    const Screen = require('../../app/(tabs)/start-workout/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => getByText('My Workout'));
    fireEvent.press(getByText('My Workout'));
    expect(mockPush).toHaveBeenCalledWith('/start-workout/1');
  });

  it('shows empty state when no templates', async () => {
    jest.spyOn(wger, 'fetchRoutines').mockResolvedValue([]);
    const Screen = require('../../app/(tabs)/start-workout/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => expect(getByText(/no templates yet/i)).toBeTruthy());
  });

  it('shows error state on fetch failure', async () => {
    jest.spyOn(wger, 'fetchRoutines').mockRejectedValue(new Error('Network'));
    const Screen = require('../../app/(tabs)/start-workout/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => expect(getByText(/failed to load templates/i)).toBeTruthy());
  });

  it('shows My Workouts section with sessions', async () => {
    jest.spyOn(wger, 'fetchRoutines').mockResolvedValue([]);
    jest.spyOn(wger, 'fetchSessions').mockResolvedValue([
      { id: 1, date: '2026-06-07', workout: 1, duration: '01:05:00', notes: 'Push Day' },
    ]);
    const Screen = require('../../app/(tabs)/start-workout/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => {
      expect(getByText('My Workouts')).toBeTruthy();
      expect(getByText('Push Day')).toBeTruthy();
    });
  });
});

// ── History screen ────────────────────────────────────────────────────────────

describe('History screen', () => {
  beforeEach(() => mockPush.mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('shows empty state when no sessions', async () => {
    jest.spyOn(wger, 'fetchSessions').mockResolvedValue([]);
    const Screen = require('../../app/(tabs)/history/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => expect(getByText(/no workouts yet/i)).toBeTruthy());
  });

  it('renders session dates when sessions exist', async () => {
    const sessions: wger.WorkoutSession[] = [
      { id: 1, date: '2026-06-07', workout: 1, duration: '01:05:00', notes: '' },
    ];
    jest.spyOn(wger, 'fetchSessions').mockResolvedValue(sessions);
    const Screen = require('../../app/(tabs)/history/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => expect(getByText(/Jun 7, 2026/i)).toBeTruthy());
  });

  it('navigates to session detail on card press', async () => {
    const sessions: wger.WorkoutSession[] = [
      { id: 42, date: '2026-06-07', workout: 1, duration: null, notes: '' },
    ];
    jest.spyOn(wger, 'fetchSessions').mockResolvedValue(sessions);
    const Screen = require('../../app/(tabs)/history/index').default;
    const { getByText } = await renderWithQuery(<Screen />);
    await waitFor(() => getByText(/Jun 7, 2026/i));
    fireEvent.press(getByText(/Jun 7, 2026/i));
    expect(mockPush).toHaveBeenCalledWith('/history/42');
  });
});
