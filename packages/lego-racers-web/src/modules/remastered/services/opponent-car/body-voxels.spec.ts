import { castBodyRays, getBodyVoxels } from './body-voxels.ts'
import type { ChampionBodyFaces } from './opponent-car.types.ts'

// A skin without an underside: a flat square roof 1.2 high over a 2 by 2 footprint, facing up.
const roof: ChampionBodyFaces = {
  positions: Float32Array.from([
    0, 0, 1.2, 0, 2, 1.2, 2, 0, 1.2, 2, 0, 1.2, 0, 2, 1.2, 2, 2, 1.2, 0, 0, 0, 2, 0, 0, 2, 0, 1.2,
  ]),
  colors: Uint8Array.from([255, 255, 255, 255, 255, 255, 255, 255, 255]),
  decals: [],
}

describe('getBodyVoxels', () => {
  it('fills a roof down to the floor and votes its colour', () => {
    // Arrange
    const grid = { countX: 2, countY: 2, countZ: 3, offsetX: 0, offsetY: 0, offsetZ: 0 }

    // Act
    const voxels = getBodyVoxels(roof, castBodyRays(roof.positions), grid)

    // Assert
    expect(voxels.fill[0]).toBeCloseTo(1, 1)
    expect(voxels.colorVotes.some((vote) => vote > 0)).toBe(true)
  })
})
