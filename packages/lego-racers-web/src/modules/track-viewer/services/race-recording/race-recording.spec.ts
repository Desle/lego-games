import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadSavedCars, DEFAULT_SAVE_PATH } from '@lego-games/lego-racers/car-builder'
import {
  createGameSession,
  createSingleRaceSettings,
  loadGameResources,
  startNextRace,
} from '@lego-games/lego-racers/game-session'
import type { RaceStart } from '@lego-games/lego-racers/game-session'
import { getTraceFields } from '@lego-games/lego-racers/golden-trace'
import { createRace, NO_MENU_INPUT, NO_RACE_CONTACTS, stepRace } from '@lego-games/lego-racers/race'
import { getRacerControls } from '@lego-games/lego-racers/race-input'
import { parseRecording } from '@lego-games/lego-racers/session-recording'
import { replayOnPort } from '@lego-games/lego-racers/session-replay'
import { createRaceRecording } from './race-recording.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../port-race/original-game-files.ts'
import { createSessionRecordingStore } from '../session-recording-store/session-recording-store.ts'
import type {
  RecordingBackend,
  StoredRecording,
} from '../session-recording-store/session-recording-store.types.ts'

const SYNTHETIC_REPLAY_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../reverse-engineering/replays/synthetic-royal-knights.replay.jsonl'
)
const FRAME_MILLISECONDS = 33
const ROYAL_KNIGHTS_FOLDER = 'RACEC0R0'
// The introduction and the countdown pass before the racers are released at frame 160.
const IDLE_FRAME_COUNT = 175
const THROTTLE_FRAME_COUNT = 60
const STEERING_FRAME_COUNT = 90

const createMemoryBackend = (): RecordingBackend => {
  const recordings = new Map<string, StoredRecording>()
  return {
    put: (recording) => Promise.resolve(recordings.set(recording.key, recording)),
    getKeys: () => Promise.resolve([...recordings.keys()].sort()),
    get: (key) => Promise.resolve(recordings.get(key) ?? null),
    remove: (key) => Promise.resolve(recordings.delete(key)),
  }
}

const getKeys = (frame: number): ReadonlySet<string> => {
  if (frame < IDLE_FRAME_COUNT) return new Set()
  if (frame < IDLE_FRAME_COUNT + THROTTLE_FRAME_COUNT) return new Set(['ArrowUp'])
  if (frame < IDLE_FRAME_COUNT + THROTTLE_FRAME_COUNT + STEERING_FRAME_COUNT) {
    return new Set(['ArrowUp', 'ArrowLeft'])
  }
  return new Set(['ArrowUp'])
}

const getRoyalKnightsStart = (jam: Uint8Array, executable: Uint8Array): RaceStart => {
  const resources = loadGameResources(jam, executable)
  const entry = resources.catalog.entries.find((candidate) => candidate.name === 'rkr')
  const playerSavedCars = loadSavedCars(resources.archive.readFile, DEFAULT_SAVE_PATH)
  const session = createGameSession(
    resources,
    createSingleRaceSettings(resources, {
      raceName: entry?.name ?? 'rkr',
      racerCount: 6,
      localPlayerCount: 1,
      randomPosition: 0,
      playerSavedCars,
    })
  )
  const start = startNextRace(session)
  if (start.kind !== 'race') throw new RangeError('The session has no race')
  return start
}

describe('the session recording', () => {
  it.skipIf(!getIsOriginalGamePresent())(
    'records a headless session that replays on the port bit for bit and equals the committed synthetic file',
    async () => {
      // Arrange
      const jam = readOriginalJam()
      const executable = readOriginalExecutable()
      const start = getRoyalKnightsStart(jam, executable)
      const store = createSessionRecordingStore(createMemoryBackend())
      const recording = createRaceRecording(start, '', store)
      let raceState = createRace(start.definition)
      const liveFields: unknown[] = []

      // Act
      const frameCount =
        IDLE_FRAME_COUNT + THROTTLE_FRAME_COUNT + STEERING_FRAME_COUNT + THROTTLE_FRAME_COUNT
      for (let frame = 0; frame < frameCount; frame += 1) {
        const input = { pressedKeyCodes: getKeys(frame), gamepad: null }
        recording?.addFrame({
          milliseconds: FRAME_MILLISECONDS,
          input,
          menu: NO_MENU_INPUT,
          grant: null,
        })
        raceState = stepRace(
          raceState,
          { controls: [getRacerControls(input)], contacts: NO_RACE_CONTACTS, menu: NO_MENU_INPUT },
          FRAME_MILLISECONDS
        ).raceState
        liveFields.push(getTraceFields(raceState, 1))
      }
      await recording?.finish()
      const text = (await store.readLast())?.text ?? ''
      const replayed = replayOnPort(parseRecording(text), jam, executable)

      // Assert
      expect(start.race.folder).toBe(ROYAL_KNIGHTS_FOLDER)
      expect(replayed.frames.map((frame) => frame.fields)).toEqual(liveFields)
      if (!existsSync(SYNTHETIC_REPLAY_PATH)) writeFileSync(SYNTHETIC_REPLAY_PATH, text)
      expect(text).toBe(readFileSync(SYNTHETIC_REPLAY_PATH, 'utf8'))
    },
    120_000
  )

  it('records nothing in the high-definition view', () => {
    // Arrange
    const store = createSessionRecordingStore(createMemoryBackend())

    // Act
    const recording = createRaceRecording(
      // Never read: the high-definition check comes first.
      Object.freeze({}) as RaceStart,
      '?hd',
      store
    )

    // Assert
    expect(recording).toBeNull()
  })
})
