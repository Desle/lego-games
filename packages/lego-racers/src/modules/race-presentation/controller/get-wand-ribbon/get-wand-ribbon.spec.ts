import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { getRibbonCorners } from '../../../ribbon/index.ts'
import { getWandRibbon, LIGHTNING_MATERIAL_NAME } from './get-wand-ribbon.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const SEGMENT_LENGTH = 50
const beam = {
  origin: { x: 0, y: 0, z: 3 },
  length: SEGMENT_LENGTH,
  points: [1, 2, 3, 4].map((count) => ({ x: 0, y: count * SEGMENT_LENGTH, z: 3 })),
}
const noJitter: readonly (readonly Vector3[])[] = [[], [], [], []]

describe('getWandRibbon (0x00454bb0)', () => {
  it('lays the four segments of the beam in the lightning material, facing the camera', () => {
    // Arrange / Act
    const ribbon = getWandRibbon(SINGLE, beam, noJitter, null)

    // Assert
    expect(ribbon.materialName).toBe(LIGHTNING_MATERIAL_NAME)
    expect(ribbon.isFacingCamera).toBe(true)
    expect(ribbon.skin.bones).toHaveLength(4)
    expect(ribbon.skin.rings.filter((ring) => ring.v === 1).length).toBeGreaterThan(4)
  })

  it('bulges the segments to alternating sides, nine units at the middle', () => {
    // Arrange
    const ribbon = getWandRibbon(SINGLE, beam, noJitter, null)

    // Act
    const corners = getRibbonCorners(SINGLE, ribbon.skin, null)

    // Assert: the beam runs along +y with its second axis to -x; the first segment bulges by +9 of that axis.
    const xs = corners.map((corner) => corner.position.x)
    expect(Math.min(...xs)).toBeLessThan(-3)
    expect(Math.max(...xs)).toBeGreaterThan(3)
  })

  it('takes the colour of the ring from the end colours of the beam', () => {
    // Arrange / Act
    const ribbon = getWandRibbon(SINGLE, beam, noJitter, null)

    // Assert: the first ring has the end colour (0x004b1568: 25, 65, 245).
    expect(ribbon.skin.rings[0]?.color).toEqual([0x19, 0x41, 0xf5, 0xff])
  })
})
