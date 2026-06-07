# CLAUDE.md — wger-app

## What this project is

A personal fitness tracker mobile app (React Native / Expo) inspired by the Strong app. Connects to a self-hosted [wger](https://github.com/wger-project/wger) instance at `http://192.168.0.11:8009` via its REST API.

## Stack

- **Expo SDK 56 + TypeScript**
- **Expo Router** — file-based tab + stack navigation
- **TanStack Query** (`@tanstack/react-query`) — API data fetching & caching
- **expo-sqlite** — local buffer for active workout sets (offline-first during session)
- **expo-secure-store** — secure token storage
- Android target — test with Android Studio emulator

## Development methodology: TDD

All features follow a **Test-Driven Development** workflow:

1. Write a failing test in `__tests__/` that describes the expected behaviour
2. Implement the feature in `lib/` or `app/` to make the test pass
3. Refactor without breaking tests
4. Run `npm test` before every commit

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

Tests live in `__tests__/lib/` (pure logic) and `__tests__/screens/` (component + integration). All network calls and SQLite are mocked in tests.

## Project file structure

```
wger-app/
├── app/
│   ├── _layout.tsx                          # Root layout + QueryClientProvider
│   └── (tabs)/
│       ├── _layout.tsx                      # Tab bar: History | Workout | Exercises
│       ├── exercises/
│       │   ├── _layout.tsx                  # Stack for exercises tab
│       │   ├── index.tsx                    # Alphabetical SectionList + search bar
│       │   └── [exerciseId].tsx             # Exercise detail (name, category, description, images)
│       ├── history/
│       │   ├── _layout.tsx                  # Stack for history tab
│       │   ├── index.tsx                    # Past sessions FlatList (empty state or sorted)
│       │   └── [sessionId].tsx             # Session detail + "Perform Again" button
│       └── start-workout/
│           ├── _layout.tsx                  # Stack for start-workout tab
│           ├── index.tsx                    # Routines list
│           └── [routineId].tsx              # Active workout: timer, day picker, set rows, FINISH
├── lib/
│   ├── wger.ts                              # API client, all types, helper functions
│   └── db.ts                               # expo-sqlite buffer for active sets
├── __tests__/
│   ├── lib/
│   │   ├── wger.test.ts                     # Unit tests: helpers, wgerFetch, pagination
│   │   └── db.test.ts                       # Unit tests: CRUD operations, camelCase mapping
│   └── screens/
│       ├── exercises.test.tsx               # Exercises index + detail screen tests
│       └── start-workout.test.tsx           # Routines list + History screen tests
├── assets/                                  # Fonts and images
├── components/                              # Shared components (from scaffold)
├── constants/                               # Colors etc.
├── package.json                             # Dependencies + jest config
└── tsconfig.json                            # TypeScript config (@/* path alias)
```

## wger API — connection

- **Base URL:** `http://192.168.0.11:8009`
- **Token:** stored in `lib/wger.ts` (constant `API_TOKEN`)
- All requests: `Authorization: Token <API_TOKEN>`

## wger API — endpoints used

| Screen | Method | Endpoint |
|---|---|---|
| Exercises list | GET | `/api/v2/exerciseinfo/?format=json&language=2&limit=100` |
| Exercise detail | GET | `/api/v2/exerciseinfo/<id>/` |
| Routines list | GET | `/api/v2/routine/?limit=100` |
| Routine days | GET | `/api/v2/day/?limit=100` then filter client-side by `d.routine === routineId` (API ignores query filters) |
| Day slots | GET | `/api/v2/slot/?day=<dayId>&limit=100` |
| Slot entries | GET | `/api/v2/slot-entry/?slot=<slotId>&limit=100` |
| History sessions | GET | `/api/v2/workoutsession/?limit=100` |
| Session logs | GET | `/api/v2/workoutlog/?workout=<id>&limit=100` |
| Log a set | POST | `/api/v2/workoutlog/` |
| Create session | POST | `/api/v2/workoutsession/` |

## wger data model

Routines have **Days** → Days have **Slots** → Slots have **SlotEntries** (exercise + config).
Exercise names come from `exerciseinfo.translations` filtered to `language: 2` (English).

## Offline strategy

Sets logged during active workout → stored in SQLite (`active_sets` table).
On FINISH → flush all confirmed sets via `POST /api/v2/workoutlog/`, create session via `POST /api/v2/workoutsession/`, then clear SQLite.

## UI theme

Dark theme inspired by **Strong** app:
- Background: `#0d0d0d` / Cards: `#1a1a1a`
- Accent (green): `#4CAF50`
- Text: `#ffffff` / Secondary: `#888888`

## Running the app

```bash
# Install Android Studio + set ANDROID_HOME, then:
npx expo start --android
```

Without Android SDK, use Expo Go on a physical device by scanning the QR code from `npx expo start`.
