import { TextureOperation } from '../../../scene/index.ts'
import { RenderMismatchKind } from '../../types/render-mismatch-kind/render-mismatch-kind.ts'
import type {
  DrawnTriangle,
  DrawState,
  RenderFrameComparison,
  RenderMismatchKind as RenderMismatchKindType,
  RenderMismatchGroup,
  RenderViewportSize,
  ScreenTriangle,
  MismatchGroupBuilder,
  PairingCandidate,
  PixelPoint,
  RenderFrameInput,
  TextureCoordinateWorst,
  VertexPairing,
} from './render-trace.types.ts'
import type { TextureMatch } from './texture-matching.types.ts'

const CELL_SIZE = 8
// A port triangle further than this from the original's is another triangle.
const MATCH_RADIUS_PIXELS = 3
// Pixels from the viewport's edge: the original clips against the edge and puts new corners exactly on it.
const EDGE_MARGIN_PIXELS = 0.01
const PERMUTATIONS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
  [0, 2, 1],
  [2, 1, 0],
  [1, 0, 2],
]

const getIsInside = (triangle: ScreenTriangle, viewport: RenderViewportSize): boolean =>
  triangle.every(
    (vertex) =>
      vertex.reciprocalW > 0 &&
      vertex.x > EDGE_MARGIN_PIXELS &&
      vertex.x < viewport.width - EDGE_MARGIN_PIXELS &&
      vertex.y > EDGE_MARGIN_PIXELS &&
      vertex.y < viewport.height - EDGE_MARGIN_PIXELS
  )

const getCellKey = (column: number, row: number): string => `${String(column)}/${String(row)}`

const getCentre = (triangle: ScreenTriangle): PixelPoint => ({
  x: (triangle[0].x + triangle[1].x + triangle[2].x) / 3,
  y: (triangle[0].y + triangle[1].y + triangle[2].y) / 3,
})

const getDistance = (left: PixelPoint, right: PixelPoint): number =>
  Math.hypot(left.x - right.x, left.y - right.y)

const getVertexPairing = (original: ScreenTriangle, port: ScreenTriangle): VertexPairing =>
  PERMUTATIONS.map((permutation): VertexPairing => {
    const distance = Math.max(
      ...permutation.map((portIndex, originalIndex) =>
        getDistance(original[originalIndex] ?? original[0], port[portIndex] ?? port[0])
      )
    )
    return { permutation, distance }
  }).reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best))

const getStateDifferences = (original: DrawState, port: DrawState): readonly string[] => {
  const names = Object.keys(original) as (keyof DrawState)[]
  return names
    .filter((name) => original[name] !== port[name])
    .map((name) => `${name} ${String(original[name])} -> ${String(port[name])}`)
}

const getIsTextured = (triangle: DrawnTriangle): boolean =>
  triangle.state.colorOperation !== TextureOperation.SELECT_DIFFUSE

const getTextureDifference = (
  original: DrawnTriangle,
  port: DrawnTriangle,
  textureMatches: ReadonlyMap<string, TextureMatch>
): string | null => {
  if (!getIsTextured(original) && port.textureKey === null) return null
  if (original.textureKey === null || port.textureKey === null) {
    return `texture ${original.textureKey ?? 'none'} -> ${port.textureKey ?? 'none'}`
  }
  const match = textureMatches.get(original.textureKey)
  if (match === undefined || match.bestKey === null) return null
  return match.acceptableKeys.includes(port.textureKey)
    ? null
    : `texture ${match.bestKey} -> ${port.textureKey}`
}

const getTextureCoordinateDifference = (
  original: ScreenTriangle,
  port: ScreenTriangle,
  pairing: VertexPairing,
  tolerance: number
): string | null => {
  const worst = pairing.permutation.reduce<TextureCoordinateWorst>(
    (current, portIndex, originalIndex) => {
      const left = original[originalIndex]
      const right = port[portIndex]
      if (left === undefined || right === undefined) return current
      const size = Math.max(Math.abs(left.u - right.u), Math.abs(left.v - right.v))
      return size > current.size ? { size, left, right } : current
    },
    { size: 0, left: original[0], right: port[0] }
  )
  return worst.size > tolerance && worst.left !== undefined && worst.right !== undefined
    ? `uv (${worst.left.u.toFixed(4)}, ${worst.left.v.toFixed(4)}) -> (${worst.right.u.toFixed(4)}, ${worst.right.v.toFixed(4)})`
    : null
}

const getColorDifference = (
  original: DrawnTriangle,
  port: DrawnTriangle,
  pairing: VertexPairing,
  tolerance: number
): string | null => {
  if (original.state.colorOperation === TextureOperation.SELECT_TEXTURE) return null
  for (const [originalIndex, portIndex] of pairing.permutation.entries()) {
    const left = original.vertices[originalIndex]?.diffuse
    const right = port.vertices[portIndex]?.diffuse
    if (left === undefined || right === undefined) continue
    const size = Math.max(...left.map((level, channel) => Math.abs(level - (right[channel] ?? 0))))
    if (size > tolerance) return `diffuse ${left.join(',')} -> ${right.join(',')}`
  }
  return null
}

// Compares what the original drew in a frame with what the port draws, triangle by triangle, matched by where they land
// on the screen. Mismatches are grouped by object and by kind.
export const compareRenderFrame = (input: RenderFrameInput): RenderFrameComparison => {
  const { viewport, tolerances, textureMatches } = input
  const original = input.original.filter((triangle) => getIsInside(triangle.vertices, viewport))
  const port = input.port.filter((triangle) => getIsInside(triangle.vertices, viewport))
  const cells = new Map<string, number[]>()
  port.forEach((triangle, index) => {
    const centre = getCentre(triangle.vertices)
    const key = getCellKey(Math.floor(centre.x / CELL_SIZE), Math.floor(centre.y / CELL_SIZE))
    cells.set(key, [...(cells.get(key) ?? []), index])
  })
  const used = new Set<number>()
  const groups = new Map<string, MismatchGroupBuilder>()
  const report = (
    kind: RenderMismatchKindType,
    source: string,
    detail: string,
    originalTriangle: DrawnTriangle | null,
    portTriangle: DrawnTriangle | null
  ) => {
    const key = `${kind}|${source}`
    const group = groups.get(key)
    if (group !== undefined) {
      group.count += 1
      return
    }
    groups.set(key, {
      count: 1,
      kind,
      source,
      firstDetail: detail,
      firstOriginal: originalTriangle,
      firstPort: portTriangle,
    })
  }
  let matchedCount = 0
  for (const triangle of original) {
    const centre = getCentre(triangle.vertices)
    const column = Math.floor(centre.x / CELL_SIZE)
    const row = Math.floor(centre.y / CELL_SIZE)
    let best: PairingCandidate | null = null
    for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        const candidates = cells.get(getCellKey(column + columnOffset, row + rowOffset)) ?? []
        for (const index of candidates) {
          const candidate = port[index]
          if (used.has(index) || candidate === undefined) continue
          const pairing = getVertexPairing(triangle.vertices, candidate.vertices)
          if (best === null || pairing.distance < best.pairing.distance) best = { index, pairing }
        }
      }
    }
    const textureName =
      triangle.textureKey === null
        ? 'untextured'
        : (textureMatches.get(triangle.textureKey)?.bestKey ?? `unmatched ${triangle.textureKey}`)
    const matched = best === null ? undefined : port[best.index]
    if (best === null || matched === undefined || best.pairing.distance > MATCH_RADIUS_PIXELS) {
      report(
        RenderMismatchKind.MISSING_IN_PORT,
        textureName,
        'no triangle at that place',
        triangle,
        null
      )
      continue
    }
    used.add(best.index)
    matchedCount += 1
    const checks: readonly (readonly [RenderMismatchKindType, string | null])[] = [
      [
        RenderMismatchKind.POSITION,
        best.pairing.distance > tolerances.positionPixels
          ? `corner off by ${best.pairing.distance.toFixed(3)} px`
          : null,
      ],
      [RenderMismatchKind.TEXTURE, getTextureDifference(triangle, matched, textureMatches)],
      [
        RenderMismatchKind.TEXTURE_COORDINATES,
        getIsTextured(triangle)
          ? getTextureCoordinateDifference(
              triangle.vertices,
              matched.vertices,
              best.pairing,
              tolerances.textureCoordinate
            )
          : null,
      ],
      [
        RenderMismatchKind.STATE,
        getStateDifferences(triangle.state, matched.state).join('; ') || null,
      ],
      [
        RenderMismatchKind.COLOR,
        getColorDifference(triangle, matched, best.pairing, tolerances.colorLevels),
      ],
    ]
    for (const [kind, detail] of checks) {
      if (detail !== null) report(kind, matched.source, detail, triangle, matched)
    }
  }
  port.forEach((triangle, index) => {
    if (!used.has(index)) {
      report(
        RenderMismatchKind.EXTRA_IN_PORT,
        triangle.source,
        'no triangle in the original',
        null,
        triangle
      )
    }
  })
  const clippedCount = input.original.length - original.length + (input.port.length - port.length)
  const groupList: RenderMismatchGroup[] = [...groups.values()].sort(
    (left, right) => right.count - left.count
  )
  return Object.freeze({
    originalCount: original.length,
    portCount: port.length,
    matchedCount,
    clippedCount,
    groups: groupList,
  })
}
