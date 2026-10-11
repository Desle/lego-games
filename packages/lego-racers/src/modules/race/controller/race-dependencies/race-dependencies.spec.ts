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

const stepFrames = (state: RaceState, frameCount: number) =>
  Array.from({ length: frameCount }).reduce<ReturnType<typeof stepRace>>(
    (step) => stepRace(step.raceState, inputsWith({}), 33),
    { raceState: state, events: [] }
  )

describe('the collision registry (0x0043d270)', () => {
  const createBrickState = (brickPosition: readonly [number, number, number]): RaceState => ({
    ...createRace({
      ...createFixtureDefinition(),
      powerUps: {
        bricks: [{ position: brickPosition, kind: 3, identifier: 0 }],
        enhancementBricks: [],
        readByteCount: 0,
      },
    }),
    phase: RacePhase.RACING,
  })

  it("registers the bricks and lists them for the racers' passes", () => {
    // Arrange / Act
    const state = createBrickState([0, 0, 0])

    // Assert
    expect(state.registryObjects).toEqual([{ type: 'power_up_brick', index: 0 }])
    expect(state.racerSet.registryEntries).toHaveLength(1)
    expect(state.racerSet.registryEntries[0]).toMatchObject({ id: 0, flags: 1, isActive: true })
  })

  it("gives a racer whose sphere reaches a brick the brick's power-up", () => {
    // Arrange
    const state = createBrickState([0, 0, 0])

    // Act
    const step = stepFrames(state, 90)

    // Assert
    const holders = step.raceState.racerSet.racers.filter((racer) => racer.heldPowerUp !== 0)
    expect(holders.length).toBeGreaterThan(0)
  })

  it("leaves a brick alone that is out of every racer's reach", () => {
    // Arrange
    const state = createBrickState([0, 500, 0])

    // Act
    const step = stepFrames(state, 90)

    // Assert
    expect(step.raceState.racerSet.racers.every((racer) => racer.heldPowerUp === 0)).toBe(true)
  })
})
