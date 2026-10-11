import {
  createFloatArithmetic,
  IDENTITY_MATRIX3,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { Ghost } from '../../types/ghost.types.ts'
import type { GhostPose } from '../../types/ghost-run/ghost-run.types.ts'
import {
  beginGhostRun,
  createGhostSession,
  finishGhostRun,
  getGhostRun,
  getIsChampionBeaten,
  loadChampionGhost,
  recordGhostSample,
  restartGhostRun,
} from './ghost-session.ts'

const ARITHMETIC = createFloatArithmetic(RACE_FPU_PRECISION)
const POSE: GhostPose = {
  position: { x: 1.5, y: -2.25, z: 100.03125 },
  rotation: IDENTITY_MATRIX3,
}

const CHAMPION: Ghost = {
  firstIntegers: [30000, 30000, 30000],
  secondInteger: 0,
  startPosition: [1, 2, 3],
  startQuaternion: [0, 0, 0, 1],
  samples: [{ position: [0, 0, 0], orientationBytes: [0, 0, 0, 127] }],
  readByteCount: 0,
}

const getRunning = () => beginGhostRun(createGhostSession(false))

describe('recordGhostSample', () => {
  it('records nothing before the race starts', () => {
    // Arrange
    const session = createGhostSession(false)

    // Act
    const recorded = recordGhostSample(ARITHMETIC, session, 33, POSE)

    // Assert
    expect(recorded).toBe(session)
  })

  it('takes a sample at once and every 250 ms after, with the overshoot taken off', () => {
    // Arrange
    let session = getRunning()

    // Act
    const counts = Array.from({ length: 6 }, () => {
      session = recordGhostSample(ARITHMETIC, session, 100, POSE)
      return session.currentRun.samples.length
    })

    // Assert
    expect(counts).toEqual([1, 1, 2, 2, 3, 3])
    expect(session.elapsedMilliseconds).toBe(600)
    expect(session.sampleTimerMilliseconds).toBe(150)
  })

  it('stores the position times 32 as a truncated 16-bit value and the quaternion times 127 as bytes', () => {
    // Arrange
    const session = getRunning()

    // Act
    const recorded = recordGhostSample(ARITHMETIC, session, 33, POSE)

    // Assert
    expect(recorded.currentRun.samples).toEqual([
      { position: [48, -72, 3201], orientationBytes: [0, 0, 0, 127] },
    ])
    expect(recorded.currentRun.startPosition).toEqual([1.5, -2.25, 100.03125])
    expect(recorded.currentRun.startQuaternion).toEqual([0, 0, 0, 1])
  })

  it('keeps the position as an int16 even when the track is larger', () => {
    // Arrange
    const session = getRunning()
    const far: GhostPose = { ...POSE, position: { x: 1500, y: 0, z: 0 } }

    // Act
    const recorded = recordGhostSample(ARITHMETIC, session, 33, far)

    // Assert
    expect(recorded.currentRun.samples[0]?.position[0]).toBe(((1500 * 32) << 16) >> 16)
  })

  it('stops recording at 961 samples but keeps the clock', () => {
    // Arrange
    let session = getRunning()

    // Act
    for (let sample = 0; sample < 970; sample += 1) {
      session = recordGhostSample(ARITHMETIC, session, 250, POSE)
    }

    // Assert
    expect(session.currentRun.samples).toHaveLength(961)
    expect(session.elapsedMilliseconds).toBe(970 * 250)
  })
})

describe('ghost runs of a session', () => {
  it('makes the first finished run the best, then keeps the faster of the next', () => {
    // Arrange
    const first = finishGhostRun(getRunning(), [30000, 31000, 32000])

    // Act
    const slower = finishGhostRun(beginGhostRun(first), [31000, 31000, 32000])
    const faster = finishGhostRun(beginGhostRun(first), [29000, 31000, 32000])

    // Assert
    expect(first.bestRun?.lapMilliseconds).toEqual([30000, 31000, 32000])
    expect(first.isRunFinished).toBe(true)
    expect(first.isRunning).toBe(false)
    expect(slower.bestRun?.lapMilliseconds).toEqual([30000, 31000, 32000])
    expect(slower.currentRun.lapMilliseconds).toEqual([31000, 31000, 32000])
    expect(faster.bestRun?.lapMilliseconds).toEqual([29000, 31000, 32000])
    expect(faster.currentRun.lapMilliseconds).toEqual([30000, 31000, 32000])
  })

  it('shows the best run beside the champion from the second start on', () => {
    // Arrange
    const first = beginGhostRun(createGhostSession(false))
    const finished = finishGhostRun(first, [30000, 30000, 30000])

    // Act
    const second = beginGhostRun(restartGhostRun(finished))

    // Assert
    expect(first.isBestRunShown).toBe(false)
    expect(second.isBestRunShown).toBe(true)
    expect(second.isRunning).toBe(true)
  })

  it('has a champion only when its file has samples', () => {
    // Arrange
    const session = createGhostSession(false)

    // Act
    const loaded = loadChampionGhost(session, CHAMPION)
    const empty = loadChampionGhost(session, { ...CHAMPION, samples: [] })
    const missing = loadChampionGhost(session, null)

    // Assert
    expect(loaded.championRun?.lapMilliseconds).toEqual([30000, 30000, 30000])
    expect(empty.championRun).toBeNull()
    expect(missing.championRun).toBeNull()
  })

  it('beats the champion when the best run adds up to less', () => {
    // Arrange
    const loaded = loadChampionGhost(createGhostSession(false), CHAMPION)
    const faster = finishGhostRun(beginGhostRun(loaded), [29999, 30000, 30000])
    const equal = finishGhostRun(beginGhostRun(loaded), [30000, 30000, 30000])
    const withoutRun = beginGhostRun(loaded)

    // Act
    const results = [faster, equal, withoutRun].map(getIsChampionBeaten)

    // Assert
    expect(results).toEqual([true, false, false])
  })

  it('is never beaten without a champion', () => {
    // Arrange
    const finished = finishGhostRun(getRunning(), [1, 1, 1])

    // Act
    const isBeaten = getIsChampionBeaten(finished)

    // Assert
    expect(isBeaten).toBe(false)
  })

  it('turns a parsed ghost into a run, leaving absent fields at zero', () => {
    // Arrange
    const ghost: Ghost = { ...CHAMPION, firstIntegers: null, startPosition: null }

    // Act
    const run = getGhostRun(ghost)

    // Assert
    expect(run.lapMilliseconds).toEqual([0, 0, 0])
    expect(run.startPosition).toEqual([0, 0, 0])
    expect(run.samples).toHaveLength(1)
  })
})
