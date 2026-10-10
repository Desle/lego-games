import { createTestContext, createTestRacerSet } from '../racer-fixtures/racer-fixtures.ts'
import { getRacer, setRacer } from '../racer-state/racer-state.ts'
import type { Checkpoint } from '../../../checkpoint/index.ts'
import type { RacerSet } from '../racer.types.ts'
import { rankRacers } from './racer-ranking.ts'

// Checkpoint 0 (progress 0.5) tests the plane of checkpoint 1: distance = 10 - x, the way still to go.
const CHECKPOINTS: readonly Checkpoint[] = [
  {
    plane: [0, 0, 1, 0],
    point: [0, 0, 0],
    progress: 0.5,
    links: [1, 0xff, 0xff, 0xff],
  },
  {
    plane: [-1, 0, 0, 10],
    point: [0, 0, 0],
    progress: 0.25,
    links: [0xff, 0xff, 0xff, 0xff],
  },
]

const placeRacer = (
  racerSet: RacerSet,
  racerIndex: number,
  lap: number,
  checkpointIndex: number,
  x: number
): RacerSet => {
  const racer = getRacer(racerSet, racerIndex)
  return setRacer(racerSet, racerIndex, {
    ...racer,
    lap,
    checkpointIndex,
    racePosition: racerIndex + 1,
    carBody: {
      ...racer.carBody,
      displayFrame: { ...racer.carBody.displayFrame, position: { x, y: 0, z: 0 } },
    },
  })
}

describe('rankRacers (0x0043c1b0)', () => {
  it('ranks by lap + checkpoint progress, then by the checkpoint plane distance: the larger distance ranks lower', () => {
    // Arrange: racer 0 at 1.25; racers 1 and 2 tied at 1.5, racer 2 further along x.
    const context = { ...createTestContext(), checkpoints: CHECKPOINTS }
    const placed = [
      [0, 1, 1, 0],
      [1, 1, 0, 3],
      [2, 1, 0, 7],
    ].reduce(
      (current, [racerIndex = 0, lap = 0, checkpoint = 0, x = 0]) =>
        placeRacer(current, racerIndex, lap, checkpoint, x),
      createTestRacerSet(3)
    )

    // Act
    const ranked = rankRacers(context, placed)

    // Assert
    expect(ranked.racers.map((racer) => racer.racePosition)).toEqual([3, 2, 1])
  })

  it('starts a voice line when the position changes, drawing two random values', () => {
    // Arrange
    const context = { ...createTestContext(), checkpoints: CHECKPOINTS }
    const placed = placeRacer(placeRacer(createTestRacerSet(2), 0, 1, 1, 0), 1, 2, 1, 0)

    // Act
    const ranked = rankRacers(context, placed)

    // Assert: racer 0 drops from 1 to 2 (values 1 and 2: 2 · 4 + 5000), racer 1 rises from 2 to 1 (3 and 4).
    expect(ranked.racers.map((racer) => racer.racePosition)).toEqual([2, 1])
    expect(ranked.racers.map((racer) => racer.voiceMilliseconds)).toEqual([5008, 5016])
    expect(ranked.randomPosition).toBe(4)
  })

  it('leaves unranked racers (flag 0x1000) alone', () => {
    // Arrange
    const racerSet = createTestRacerSet(1)
    const unranked = setRacer(racerSet, 0, { ...getRacer(racerSet, 0), flags: 0x1000 })

    // Act
    const ranked = rankRacers(createTestContext(), unranked)

    // Assert
    expect(getRacer(ranked, 0).racePosition).toBe(0)
  })
})
