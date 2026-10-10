import { getRacer } from '../../../racer/index.ts'
import type { Checkpoint } from '../../../checkpoint/index.ts'
import { RacePhase } from '../../types/race-phase/race-phase.ts'
import type { RaceInputs, RaceState } from '../../types/race.types.ts'
import { createRace } from '../create-race/create-race.ts'
import { createFixtureDefinition } from '../race-fixtures/race-fixtures.ts'
import { IDLE_RACER_CONTROLS, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import { stepRace } from '../step-race/step-race.ts'

const START_LINE: Checkpoint = {
  plane: [1, 0, 0, 0],
  point: [0, 0, 0],
  progress: 0,
  links: [1, 0xff, 0xff, 0xff],
}
const NEXT: Checkpoint = { ...START_LINE, progress: 0.5, links: [0, 0xff, 0xff, 0xff] }

const createRacingState = (): RaceState => ({
  ...createRace({ ...createFixtureDefinition(), checkpoints: [START_LINE, NEXT] }),
  phase: RacePhase.RACING,
})

const inputsWith = (contacts: Partial<RaceInputs['contacts']>): RaceInputs => ({
  controls: [IDLE_RACER_CONTROLS],
  contacts: { ...NO_RACE_CONTACTS, ...contacts },
})

describe('the contacts a frame delivers', () => {
  it('counts a lap at the start line when a racer crosses it forwards (0x00439fc0)', () => {
    // Arrange
    const state = createRacingState()
    const inputs = inputsWith({
      checkpointTouches: [{ racerIndex: 1, checkpointIndex: 0, direction: { x: 1, y: 0, z: 0 } }],
    })

    // Act
    const step = stepRace(state, inputs, 33)

    // Assert
    expect(getRacer(step.raceState.racerSet, 1)).toMatchObject({
      checkpointIndex: 0,
      checkpointSide: 1,
      lap: 0,
    })
    expect(getRacer(step.raceState.racerSet, 0).checkpointIndex).toBe(-1)
  })

  it('starts the next lap when a racer goes through the zones 1, 2, 0 and 1 again (0x00439ba0)', () => {
    // Arrange
    const state = createRacingState()
    const crossing = (zone: number) => ({ racerIndex: 0, zone })
    const inputs = inputsWith({
      zoneCrossings: [crossing(1), crossing(2), crossing(0), crossing(1)],
    })

    // Act
    const step = stepRace(state, inputs, 33)

    // Assert
    expect(getRacer(step.raceState.racerSet, 0)).toMatchObject({ currentLap: 1, lapCrossings: 1 })
  })

  it('delivers the contacts once, in the first sub-step of the frame', () => {
    // Arrange
    const state = createRacingState()
    const inputs = inputsWith({
      checkpointTouches: [{ racerIndex: 1, checkpointIndex: 0, direction: { x: 1, y: 0, z: 0 } }],
    })

    // Act
    const step = stepRace(state, inputs, 90)

    // Assert
    expect(getRacer(step.raceState.racerSet, 1).lap).toBe(0)
  })
})
