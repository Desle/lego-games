import { getIsInside, getTextureDifference } from '../compare-render-frame.ts'
import { projectVertex } from '../screen-projection.ts'
import type { TextureMatch } from '../texture-matching.types.ts'
import type {
  ClippedPolygon,
  DepthRange,
  DrawnTriangle,
  PixelPoint,
  RenderViewportSize,
  ScreenMatrix,
  ScreenTriangle,
  WorldTriangle,
  WorldVertex,
} from '../render-trace.types.ts'

// Closer than this the clip is a numeric edge, not the near plane the original cuts at.
const MINIMUM_CLIP_W = 0.001
const PLANE_DEPTH_TOLERANCE = 0.05
// Pixels a fragment's corner may lie outside the polygon of its whole triangle.
const CONTAINMENT_TOLERANCE_PIXELS = 0.75

type ClipCorner = { readonly x: number; readonly y: number; readonly w: number }

const getClipCorner = (vertex: WorldVertex, matrix: ScreenMatrix): ClipCorner => {
  const projected = projectVertex(vertex, matrix)
  return { x: projected.x * projected.clipW, y: projected.y * projected.clipW, w: projected.clipW }
}

const getCutAtNearPlane = (corners: readonly ClipCorner[]): readonly ClipCorner[] =>
  corners.flatMap((corner, index): readonly ClipCorner[] => {
    const next = corners[(index + 1) % corners.length] ?? corner
    const isCornerKept = corner.w >= MINIMUM_CLIP_W
    const isNextKept = next.w >= MINIMUM_CLIP_W
    if (isCornerKept === isNextKept) return isCornerKept ? [corner] : []
    const fraction = (MINIMUM_CLIP_W - corner.w) / (next.w - corner.w)
    const crossing: ClipCorner = {
      x: corner.x + (next.x - corner.x) * fraction,
      y: corner.y + (next.y - corner.y) * fraction,
      w: MINIMUM_CLIP_W,
    }
    return isCornerKept ? [corner, crossing] : [crossing]
  })

const getSignedArea = (corners: readonly PixelPoint[]): number =>
  corners.reduce((total, corner, index) => {
    const next = corners[(index + 1) % corners.length] ?? corner
    return total + (corner.x * next.y - next.x * corner.y)
  }, 0)

const getIsInsideViewport = (corner: PixelPoint, viewport: RenderViewportSize): boolean =>
  corner.x > 0 && corner.x < viewport.width && corner.y > 0 && corner.y < viewport.height

// A front-facing triangle of the port that the original's driver would cut (a corner outside the viewport or behind the
// near plane) as the convex polygon that is left; null when it is whole, back-facing or entirely behind the camera.
export const getClippedPolygon = (
  triangle: WorldTriangle,
  matrix: ScreenMatrix,
  space: 'world' | 'local',
  viewport: RenderViewportSize,
  depthRange: DepthRange | null
): ClippedPolygon | null => {
  const corners = (space === 'world' ? triangle.vertices : triangle.localVertices).map((vertex) =>
    getClipCorner(vertex, matrix)
  )
  const isWhole = corners.every(
    (corner) =>
      corner.w > 0 &&
      (depthRange === null || (corner.w >= depthRange.near && corner.w <= depthRange.far))
  )
  const kept = getCutAtNearPlane(corners)
  if (kept.length < 3) return null
  const polygon = kept.map((corner): PixelPoint => ({
    x: corner.x / corner.w,
    y: corner.y / corner.w,
  }))
  if (isWhole && polygon.every((corner) => getIsInsideViewport(corner, viewport))) return null
  // GolDP.dll 0x1000ebd0 keeps a triangle whose screen turn is negative; the polygon's turn is its signed area.
  if (getSignedArea(polygon) >= 0) return null
  return Object.freeze({
    corners: polygon,
    textureKey: triangle.textureKey,
    source: triangle.source,
  })
}

// A triangle of the original's that its driver made by cutting a larger one: a corner on the viewport's edge or on the
// near or far plane.
export const getIsCutPiece = (
  triangle: ScreenTriangle,
  viewport: RenderViewportSize,
  depthRange: DepthRange | null
): boolean =>
  !getIsInside(triangle, viewport) ||
  (depthRange !== null &&
    triangle.some((vertex) => {
      const depth = 1 / vertex.reciprocalW
      return (
        Math.abs(depth - depthRange.near) < PLANE_DEPTH_TOLERANCE ||
        Math.abs(depth - depthRange.far) < PLANE_DEPTH_TOLERANCE
      )
    }))

const getIsInsideConvexPolygon = (point: PixelPoint, polygon: ClippedPolygon): boolean =>
  polygon.corners.every((corner, index) => {
    const next = polygon.corners[(index + 1) % polygon.corners.length] ?? corner
    const edgeX = next.x - corner.x
    const edgeY = next.y - corner.y
    const length = Math.hypot(edgeX, edgeY)
    if (length === 0) return true
    // The polygon winds with a negative area, so its inside is on the negative side of every edge.
    const side = (edgeX * (point.y - corner.y) - edgeY * (point.x - corner.x)) / length
    return side <= CONTAINMENT_TOLERANCE_PIXELS
  })

const getAreAllCornersInside = (vertices: ScreenTriangle, polygon: ClippedPolygon): boolean =>
  vertices.every((vertex) => getIsInsideConvexPolygon(vertex, polygon))

// Whether a triangle the original drew is a piece of a whole port triangle that its driver cut: every corner lies in the
// polygon the port triangle leaves after the same cut, and the port draws the triangle with the original's texture (or the
// original's state uses none).
export const getIsFragmentOfPolygon = (
  fragment: DrawnTriangle,
  polygons: readonly ClippedPolygon[],
  textureMatches: ReadonlyMap<string, TextureMatch>
): boolean =>
  polygons.some(
    (polygon) =>
      getTextureDifference(fragment, polygon, textureMatches) === null &&
      getAreAllCornersInside(fragment.vertices, polygon)
  )
