import type { MaterialAnimation } from '../../../material-animation/index.ts'
import {
  getAdvancedMaterialPlayback,
  getStartedMaterialPlayback,
  IDLE_MATERIAL_PLAYBACK,
} from '../material-animation-playback/material-animation-playback.ts'
import { EMPTY_WORLD_ANIMATION, getMaterialSlotWrites } from './world-animation.ts'
import type { WorldAnimation } from '../../types/world-animation.types.ts'

// The wall lights of RACEC3R0's TEST.MAB: two entries, four rows each, 8 frames, 0.03 frames per millisecond.
const definition: MaterialAnimation = Object.freeze({
  materials: [
    { materialName: 'rrlite8', value: 0 },
    { materialName: 'rrlite7', value: 2 },
    { materialName: 'rrlite6', value: 4 },
    { materialName: 'rrlite5', value: 6 },
    { materialName: 'rrlite4', value: 0 },
    { materialName: 'rrlite3', value: 2 },
    { materialName: 'rrlite2', value: 4 },
    { materialName: 'rrlite1', value: 6 },
  ],
  entries: [
    { keyword27Values: [0, 4] as const, keyword29Value: 8, keyword2aValue: 0.03 },
    { keyword27Values: [4, 4] as const, keyword29Value: 8, keyword2aValue: 0.03 },
  ],
  readByteCount: 0,
})

const createWorld = (
  target: {
    readonly instanceName: string
    readonly levelIndex: number
    readonly slot: number
  } | null
): WorldAnimation => ({
  ...EMPTY_WORLD_ANIMATION,
  materialAnimations: [
    {
      name: 'test',
      definition,
      entries: [
        { ...getStartedMaterialPlayback(IDLE_MATERIAL_PLAYBACK, true), target },
        IDLE_MATERIAL_PLAYBACK,
      ],
    },
  ],
})

const advance = (world: WorldAnimation, milliseconds: number): WorldAnimation => ({
  ...world,
  materialAnimations: world.materialAnimations.map((animation) => ({
    ...animation,
    entries: animation.entries.map((playback, entryIndex) =>
      getAdvancedMaterialPlayback(animation.definition, entryIndex, playback, milliseconds)
    ),
  })),
})

describe('getMaterialSlotWrites', () => {
  it('writes nothing before the first advance', () => {
    // Arrange
    const world = createWorld({ instanceName: 'rrtrack', levelIndex: 0, slot: 17 })

    // Act
    const writes = getMaterialSlotWrites(world)

    // Assert
    expect(writes).toEqual([])
  })

  it('writes the row the time selects into the entry target, and only for started entries', () => {
    // Arrange
    const target = { instanceName: 'rrtrack', levelIndex: 0, slot: 17 }
    const world = createWorld(target)

    // Act
    const atStart = getMaterialSlotWrites(advance(world, 0))
    const atTwoFrames = getMaterialSlotWrites(advance(world, 70))

    // Assert
    expect(atStart).toEqual([{ ...target, materialName: 'rrlite8' }])
    expect(atTwoFrames).toEqual([{ ...target, materialName: 'rrlite7' }])
  })

  it('writes nothing for an entry without a target', () => {
    // Arrange
    const world = advance(createWorld(null), 100)

    // Act
    const writes = getMaterialSlotWrites(world)

    // Assert
    expect(writes).toEqual([])
  })
})
