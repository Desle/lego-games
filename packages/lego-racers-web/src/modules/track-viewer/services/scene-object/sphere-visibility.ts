import type { FrustumView, Vector3Like } from '../race-viewport/race-viewport.types.ts'

// GolDP.dll 0x1002bc20: a sphere is left out when its centre lies farther than the radius behind any plane of the frustum.
export const getIsSphereInFrustum = (
  view: FrustumView,
  centre: Vector3Like,
  radius: number
): boolean =>
  view.planes.every(([normalX, normalY, normalZ, offset]) => {
    const distance = normalX * centre.x + normalY * centre.y + normalZ * centre.z + offset
    return !(distance <= radius && distance < -radius)
  })
