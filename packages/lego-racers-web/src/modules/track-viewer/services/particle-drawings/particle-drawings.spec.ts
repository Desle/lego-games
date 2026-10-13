import type { EmitterQuad } from '@lego-games/lego-racers/emitter'
import type { Scene } from '@lego-games/lego-racers/scene'
import { Group } from 'three'
import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { ParticleDrawing } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getMaterialParticleDrawings, getParticleView } from './particle-drawings.ts'

const getScene = (names: readonly string[]): Scene =>
  ({ materials: names.map((name) => ({ name })) }) as unknown as Scene

const createDrawing = (): ParticleDrawing => ({
  object: new Group(),
  setParticles: () => undefined,
  dispose: () => undefined,
})

describe('getMaterialParticleDrawings', () => {
  afterEach(() => clearViewerExtensions())

  it('asks for nothing to draw without a layer', () => {
    // Arrange
    const scenes = [getScene(['smoke1', 'dust1'])]

    // Act
    const drawings = getMaterialParticleDrawings(scenes)

    // Assert
    expect(drawings.size).toBe(0)
  })

  it("keeps the layer's drawing of each material it has one for, once per name", () => {
    // Arrange
    const smoke = createDrawing()
    const asked: string[] = []
    registerViewerExtension({
      ...NEUTRAL_EXTENSION,
      getParticleDrawing: ({ materialName }) => {
        asked.push(materialName)
        return materialName.startsWith('smoke') ? smoke : null
      },
    })

    // Act
    const drawings = getMaterialParticleDrawings([
      getScene(['smoke1', 'tree']),
      getScene(['smoke1', 'smoke2']),
    ])

    // Assert
    expect([asked, [...drawings.keys()], drawings.get('smoke2') === smoke]).toEqual([
      ['smoke1', 'tree', 'smoke2'],
      ['smoke1', 'smoke2'],
      true,
    ])
  })
})

describe('getParticleView', () => {
  it("gives a quad's centre and its two sides", () => {
    // Arrange
    const quad: EmitterQuad = {
      materialName: 'smoke1',
      corners: [
        { x: 0, y: 0, z: 0, u: 0, v: 0 },
        { x: 4, y: 0, z: 0, u: 1, v: 0 },
        { x: 4, y: 0, z: -2, u: 1, v: 1 },
        { x: 0, y: 0, z: -2, u: 0, v: 1 },
      ],
    }

    // Act
    const view = getParticleView(quad, [200, 200, 200, 30])

    // Assert
    expect(view).toEqual({
      materialName: 'smoke1',
      centre: { x: 2, y: 0, z: -1 },
      right: { x: 4, y: 0, z: 0 },
      down: { x: 0, y: 0, z: -2 },
      color: [200, 200, 200, 30],
    })
  })
})
