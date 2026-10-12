import type { CinemaEvents } from '../../types/cinema-events.types.ts'
import type { Cinema, CinemaDummy } from '../../types/cinema.types.ts'
import { getActiveCinemaColourShifts, getCinemaFrame } from './get-cinema-playback.ts'

const flash: CinemaDummy = {
  name: 'MM_FLSH',
  startFrame: 14,
  durationFrames: 1,
  position: [0, 0, 0],
  forward: [1, 0, 0],
  up: [0, 0, 1],
}
const cinema: Cinema = {
  name: 'space1',
  lengthFrames: 200,
  framesPerSecond: 30,
  objects: [],
  actions: [],
  dummies: [flash],
  ambientLights: [],
  directionalLights: [],
}
const events: CinemaEvents = {
  poolNames: [],
  emitterEvents: [],
  vertexEffects: [
    {
      name: 'vtx1',
      shifts: [0, 0, 0],
      biases: [64, 0, 0],
      rates: [0, 0, 0],
      instanceName: 'mm_sky',
    },
  ],
  reactionLists: [
    {
      listKeyword: 0x56,
      starts: [{ entryName: 'MM_FLSH', targetKeyword: 0x2b, targetName: 'vtx1' }],
      stops: [],
    },
  ],
}

describe('getActiveCinemaColourShifts', () => {
  it('shifts the sky red for the one frame the flash dummy is on', () => {
    // Arrange
    const flashMilliseconds = 495

    // Act
    const during = getActiveCinemaColourShifts(cinema, events, flashMilliseconds)
    const after = getActiveCinemaColourShifts(cinema, events, flashMilliseconds + 33)

    // Assert
    expect(getCinemaFrame(cinema, flashMilliseconds)).toBe(14)
    expect(during).toEqual([
      { instanceName: 'mm_sky', shifts: [0, 0, 0, 0], biases: [64, 0, 0, 0] },
    ])
    expect(after).toEqual([])
  })
})
