import { getRibbonSkin, LIGHTNING_RIBBON_SHAPE } from '../../../ribbon/index.ts'
import type { RibbonSegment, RibbonView } from '../../../ribbon/index.ts'
import type { WandBeam } from '../../../projectiles/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'

// 0x004b155c: the beam's segments bulge sideways by this much, to alternating sides.
const BEAM_BULGE = 9
// The beam is drawn in this material (0x004548f0 looks up "lightng").
export const LIGHTNING_MATERIAL_NAME = 'lightng'

// 0x00454bb0: the beam of a wand as a ribbon from the point 3 above the muzzle through the four points of the beam; the
// figure faces the camera.
export const getWandRibbon = (
  arithmetic: FloatArithmetic,
  beam: WandBeam,
  jitter: readonly (readonly Vector3[])[],
  initialJitter: Vector3 | null
): RibbonView => {
  const { subtract, storeFloat } = arithmetic
  const [first] = beam.points
  const segments: readonly RibbonSegment[] = beam.points.map((end, index) =>
    Object.freeze({
      end,
      bulge: index % 2 === 0 ? BEAM_BULGE : -BEAM_BULGE,
      jitter: jitter[index] ?? null,
    })
  )
  const direction = Object.freeze({
    x: storeFloat(subtract(first?.x ?? 0, beam.origin.x)),
    y: storeFloat(subtract(first?.y ?? 0, beam.origin.y)),
    z: storeFloat(subtract(first?.z ?? 0, beam.origin.z)),
  })
  return Object.freeze({
    materialName: LIGHTNING_MATERIAL_NAME,
    skin: getRibbonSkin(arithmetic, LIGHTNING_RIBBON_SHAPE, {
      begin: beam.origin,
      direction,
      initialJitter,
      segments,
    }),
    isFacingCamera: true,
  })
}
