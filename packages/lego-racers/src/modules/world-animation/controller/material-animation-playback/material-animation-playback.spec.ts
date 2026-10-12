import type { MaterialAnimation } from '../../../material-animation/index.ts'
import {
  getAdvancedMaterialPlayback,
  getMaterialPlaybackAtLastFrame,
  getStartedMaterialPlayback,
  getStoppedMaterialPlayback,
  IDLE_MATERIAL_PLAYBACK,
} from './material-animation-playback.ts'

const definition: MaterialAnimation = Object.freeze({
  materials: [
    { materialName: 'a', value: 0 },
    { materialName: 'b', value: 10 },
    { materialName: 'c', value: 20 },
  ],
  entries: [{ keyword27Values: [0, 3] as const, keyword29Value: 30, keyword2aValue: 0.5 }],
  readByteCount: 0,
})

describe('getAdvancedMaterialPlayback', () => {
  it('does nothing for an entry nobody started', () => {
    // Arrange
    // Act
    const advanced = getAdvancedMaterialPlayback(definition, 0, IDLE_MATERIAL_PLAYBACK, 100)

    // Assert
    expect(advanced).toBe(IDLE_MATERIAL_PLAYBACK)
  })

  it('moves the time by rate times milliseconds and selects the last started row', () => {
    // Arrange
    const playing = getStartedMaterialPlayback(IDLE_MATERIAL_PLAYBACK, true)

    // Act
    const advanced = getAdvancedMaterialPlayback(definition, 0, playing, 30)

    // Assert
    expect(advanced.time).toBe(15)
    expect(advanced.tableIndex).toBe(1)
  })

  it('wraps a looping entry at its length', () => {
    // Arrange
    const playing = getStartedMaterialPlayback(IDLE_MATERIAL_PLAYBACK, true)

    // Act
    const advanced = getAdvancedMaterialPlayback(definition, 0, playing, 70)

    // Assert
    expect(advanced.time).toBe(35)
    expect(advanced.tableIndex).toBe(0)
    expect(advanced.isPlaying).toBe(true)
  })

  it('stops and rewinds an entry that does not loop once it reaches its length', () => {
    // Arrange
    const playing = getStartedMaterialPlayback(IDLE_MATERIAL_PLAYBACK, false)

    // Act
    const advanced = getAdvancedMaterialPlayback(definition, 0, playing, 60)

    // Assert
    expect(advanced).toEqual({
      isPlaying: false,
      isLooping: false,
      time: 0,
      tableIndex: null,
      target: null,
    })
  })
})

describe('the entry controls', () => {
  it('stops an entry and puts its time at the last frame', () => {
    // Arrange
    const playing = getStartedMaterialPlayback(IDLE_MATERIAL_PLAYBACK, true)

    // Act
    const stopped = getStoppedMaterialPlayback(playing)
    const atEnd = getMaterialPlaybackAtLastFrame(definition, 0, stopped)

    // Assert
    expect(stopped).toMatchObject({ isPlaying: false, isLooping: false })
    expect(atEnd.time).toBe(29)
  })
})
