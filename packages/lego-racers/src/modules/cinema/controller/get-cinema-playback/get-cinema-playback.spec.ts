import type { CinemaEvents } from '../../types/cinema-events.types.ts'
import type { Cinema, CinemaDummy } from '../../types/cinema.types.ts'
import { getActiveCinemaVertexEffects, getCinemaFrame } from './get-cinema-playback.ts'

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

describe('getActiveCinemaVertexEffects', () => {
  it('starts the sky effect for the one frame the flash dummy is on', () => {
    // Arrange
    const flashMilliseconds = 495

    // Act
    const during = getActiveCinemaVertexEffects(cinema, events, flashMilliseconds)
    const after = getActiveCinemaVertexEffects(cinema, events, flashMilliseconds + 33)

    // Assert
    expect(getCinemaFrame(cinema, flashMilliseconds)).toBe(14)
    expect(during.map((active) => [active.dummyIndex, active.effect.instanceName])).toEqual([
      [0, 'mm_sky'],
    ])
    expect(after).toEqual([])
  })
})
