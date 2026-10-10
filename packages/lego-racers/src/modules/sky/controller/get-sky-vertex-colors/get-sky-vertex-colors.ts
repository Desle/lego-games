import type { SkyDome, SkyRingColors } from '../../types/sky.types.ts'

const OPAQUE = 0xff

// 0x0041cfc0 gives the first `segmentCount` vertices (ring 0) the first colour, the next ring the second and the
// last the third. The vertex colour setter (GolDP.dll 0x10006250) packs bytes R, G, B and a fourth byte that the
// caller leaves unset when it blends; skymat ignores vertex alpha, so it is 0xff here.
export const getSkyVertexColors = (dome: SkyDome, ringColors: SkyRingColors): Uint8Array => {
  const colors = new Uint8Array(dome.vertexCount * 4)
  for (let vertex = 0; vertex < dome.vertexCount; vertex++) {
    const ring = Math.min(Math.floor(vertex / dome.segmentCount), ringColors.length - 1)
    const [red, green, blue] = ringColors[ring] ?? ringColors[0]
    colors.set([red, green, blue, OPAQUE], vertex * 4)
  }
  return colors
}
