import type { Cinema, CinemaEvents } from '../../../cinema/index.ts'
import { advanceRacePreviewEffects, getRacePreviewColourShifts } from './race-preview-effects.ts'

const cinema: Cinema = {
  name: 'space1',
  lengthFrames: 200,
  framesPerSecond: 30,
  objects: [],
  actions: [],
  dummies: [
    {
      name: 'MM_FLSH',
      startFrame: 0,
      durationFrames: 100,
      position: [0, 0, 0],
      forward: [1, 0, 0],
      up: [0, 0, 1],
    },
  ],
  ambientLights: [],
  directionalLights: [],
}
const getEvents = (rates: readonly number[]): CinemaEvents => ({
  poolNames: [],
  emitterEvents: [],
  vertexEffects: [
    { name: 'vtx1', shifts: [0, 0, 0], biases: [64, 0, 0], rates, instanceName: 'mm_sky' },
  ],
  reactionLists: [
    {
      listKeyword: 0x56,
      starts: [{ entryName: 'MM_FLSH', targetKeyword: 0x2b, targetName: 'vtx1' }],
      stops: [],
    },
  ],
})
const FRAME_MILLISECONDS = 33

const getStep = (
  previous: ReturnType<typeof advanceRacePreviewEffects>,
  events: CinemaEvents,
  milliseconds: number,
  isRestarted = false
) =>
  advanceRacePreviewEffects({
    previous,
    cinema,
    events,
    previousMilliseconds: milliseconds - FRAME_MILLISECONDS,
    milliseconds,
    frameMilliseconds: FRAME_MILLISECONDS,
    isRestarted,
  })

describe('advanceRacePreviewEffects', () => {
  it('starts an effect with the biases of the file and keeps them while its rates are zero', () => {
    // Arrange
    const events = getEvents([0, 0, 0])

    // Act
    const first = getStep(null, events, 0, true)
    const second = getStep(first, events, FRAME_MILLISECONDS)

    // Assert
    expect(getRacePreviewColourShifts(second)).toEqual([
      { instanceName: 'mm_sky', shifts: [0, 0, 0, 0], biases: [64, 0, 0, 0] },
    ])
  })

  it('adds the rates times the frame time to the biases once a step reaches a whole unit', () => {
    // Arrange
    const events = getEvents([100, 0, 0])

    // Act
    const first = getStep(null, events, 0, true)
    const second = getStep(first, events, FRAME_MILLISECONDS)

    // Assert
    expect(first?.active[0]?.currentBiases[0]).toBeCloseTo(67.3, 1)
    expect(second?.active[0]?.currentBiases[0]).toBeCloseTo(70.6, 1)
    expect(getRacePreviewColourShifts(second)[0]?.biases[0]).toBe(70)
  })

  it('adds nothing while every step is smaller than a whole unit', () => {
    // Arrange
    const events = getEvents([10, 0, 0])

    // Act
    const step = getStep(getStep(null, events, 0, true), events, FRAME_MILLISECONDS)

    // Assert
    expect(step?.active[0]?.currentBiases[0]).toBe(64)
  })

  it('stops the effect when its dummy goes off', () => {
    // Arrange
    const events = getEvents([0, 0, 0])
    const on = getStep(null, events, 0, true)

    // Act
    const off = getStep(on, events, 4000)

    // Assert
    expect(getRacePreviewColourShifts(off)).toEqual([])
  })
})
