import { TextureOperation } from '../../../scene/index.ts'
import type { OriginalRenderFrame } from '../../types/presentation-trace.types.ts'
import { getDrawState } from './original-triangles.ts'
import type { QuadComparison, QuadGroup, QuadPlacement, QuadsInput } from './render-trace.types.ts'

const QUAD_VERTEX_COUNT = 4
const FIRST_CORNER = 0
const OPPOSITE_CORNER = 3

// The textured rectangles the original drew in a frame: every four-vertex draw (the menu's images, glyphs and fills; the
// front end's 3D scenes have more vertices), by the corners it covers.
export const getOriginalQuads = (frame: OriginalRenderFrame): readonly QuadPlacement[] => {
  const states = frame.states.map(getDrawState)
  return frame.draws.flatMap((draw) => {
    const first = draw.vertices[FIRST_CORNER]
    const last = draw.vertices[OPPOSITE_CORNER]
    if (draw.vertices.length !== QUAD_VERTEX_COUNT || first === undefined || last === undefined) {
      return []
    }
    const state = states[draw.stateIndex]
    const isTextured =
      state !== undefined && state.colorOperation !== TextureOperation.SELECT_DIFFUSE
    const xs = draw.vertices.map((vertex) => vertex.x)
    const ys = draw.vertices.map((vertex) => vertex.y)
    return [
      {
        left: Math.min(...xs),
        top: Math.min(...ys),
        right: Math.max(...xs),
        bottom: Math.max(...ys),
        textureKey: isTextured ? draw.textureHash : null,
        source: isTextured ? (draw.textureHash ?? 'untextured') : 'fill',
      },
    ]
  })
}

const getIsSameRectangle = (
  left: QuadPlacement,
  right: QuadPlacement,
  tolerance: number
): boolean =>
  Math.abs(left.left - right.left) <= tolerance &&
  Math.abs(left.top - right.top) <= tolerance &&
  Math.abs(left.right - right.right) <= tolerance &&
  Math.abs(left.bottom - right.bottom) <= tolerance

const addToGroup = (
  groups: Map<string, QuadGroup>,
  kind: QuadGroup['kind'],
  source: string,
  detail: string
) => {
  const key = `${kind}|${source}`
  const known = groups.get(key)
  groups.set(key, {
    kind,
    source,
    count: (known?.count ?? 0) + 1,
    firstDetail: known?.firstDetail ?? detail,
  })
}

const describe = (quad: QuadPlacement): string =>
  `(${quad.left.toFixed(1)}, ${quad.top.toFixed(1)}) to (${quad.right.toFixed(1)}, ${quad.bottom.toFixed(1)})`

// Compares the rectangles the original drew with the port's: a rectangle with no partner is missing or extra, one with a
// partner must show the same picture.
export const compareQuadPlacements = (input: QuadsInput): QuadComparison => {
  const groups = new Map<string, QuadGroup>()
  const used = new Set<number>()
  let matchedCount = 0
  for (const quad of input.original) {
    const name =
      quad.textureKey === null
        ? quad.source
        : (input.textureMatches.get(quad.textureKey)?.bestKey ?? quad.source)
    const index = input.port.findIndex(
      (candidate, candidateIndex) =>
        !used.has(candidateIndex) && getIsSameRectangle(quad, candidate, input.tolerancePixels)
    )
    const partner = input.port[index]
    if (partner === undefined) {
      addToGroup(groups, 'missing_in_port', name, describe(quad))
      continue
    }
    used.add(index)
    matchedCount += 1
    if (quad.textureKey === null || partner.textureKey === null) continue
    const match = input.textureMatches.get(quad.textureKey)
    if (
      match !== undefined &&
      match.bestKey !== null &&
      !match.acceptableKeys.includes(partner.textureKey)
    ) {
      addToGroup(
        groups,
        'texture',
        partner.source,
        `${match.bestKey} -> ${partner.textureKey} at ${describe(quad)}`
      )
    }
  }
  input.port.forEach((quad, index) => {
    if (!used.has(index)) addToGroup(groups, 'extra_in_port', quad.source, describe(quad))
  })
  return Object.freeze({
    originalCount: input.original.length,
    portCount: input.port.length,
    matchedCount,
    groups: [...groups.values()].sort((left, right) => right.count - left.count),
  })
}
