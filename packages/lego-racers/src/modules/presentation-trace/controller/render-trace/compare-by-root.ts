import { compareRenderFrame } from './compare-render-frame.ts'
import { getClippedPolygon } from './clipped-polygon/clipped-polygon.ts'
import { projectWorldTriangle } from './screen-projection.ts'
import type {
  DrawnTriangle,
  RenderFrameInput,
  ScreenMatrix,
  WorldTriangle,
} from './render-trace.types.ts'
import type { RootChoice, RootComparison, RootComparisonInput } from './compare-by-root.types.ts'

const SPACES = ['world', 'local'] as const

const getProjected = (
  triangles: readonly WorldTriangle[],
  matrix: ScreenMatrix,
  space: 'world' | 'local'
): readonly DrawnTriangle[] =>
  triangles.flatMap((triangle) => {
    const drawn = projectWorldTriangle(triangle, matrix, space)
    return drawn === null ? [] : [drawn]
  })

const getRootInput = (
  input: RootComparisonInput,
  original: readonly DrawnTriangle[],
  port: readonly DrawnTriangle[]
): RenderFrameInput => ({
  original,
  port,
  viewport: input.viewport,
  textureMatches: input.textureMatches,
  tolerances: input.tolerances,
})

// The original draws most of the world with the identity as model matrix, but a car part or the warp's tunnel with a
// matrix of its own (its frame times the camera's). Every object tree of the port takes, in turn, the candidate matrix
// and the space (the world's or its own) under which it lands on the most of the original's triangles that no earlier
// tree matched; the whole frame is then compared with every tree under its choice.
export const compareRenderFrameByRoot = (input: RootComparisonInput): RootComparison => {
  const rootIndices = [...new Set(input.port.map((triangle) => triangle.root))]
  const getTriangles = (root: number) => input.port.filter((triangle) => triangle.root === root)
  const ordered = [...rootIndices].sort(
    (left, right) => getTriangles(right).length - getTriangles(left).length
  )
  let remaining = input.original
  const choices: RootChoice[] = []
  for (const root of ordered) {
    const own = getTriangles(root)
    let chosen: RootChoice = { root, candidateIndex: 0, space: 'world', matchedCount: -1 }
    let chosenMatched: readonly DrawnTriangle[] = []
    for (const [candidateIndex, matrix] of input.candidates.entries()) {
      for (const space of SPACES) {
        const comparison = compareRenderFrame(
          getRootInput(input, remaining, getProjected(own, matrix, space))
        )
        if (comparison.matchedCount > chosen.matchedCount) {
          chosen = { root, candidateIndex, space, matchedCount: comparison.matchedCount }
          chosenMatched = comparison.matchedOriginals
        }
      }
    }
    choices.push(chosen)
    const taken = new Set(chosenMatched)
    remaining = remaining.filter((triangle) => !taken.has(triangle))
  }
  const port = choices.flatMap((choice) => {
    const matrix = input.candidates[choice.candidateIndex]
    return matrix === undefined ? [] : getProjected(getTriangles(choice.root), matrix, choice.space)
  })
  const clippedPolygons = choices.flatMap((choice) => {
    const matrix = input.candidates[choice.candidateIndex]
    return matrix === undefined
      ? []
      : getTriangles(choice.root).flatMap((triangle) => {
          const polygon = getClippedPolygon(triangle, matrix, choice.space, input.viewport)
          return polygon === null ? [] : [polygon]
        })
  })
  return Object.freeze({
    ...compareRenderFrame(getRootInput(input, input.original, port)),
    choices,
    clippedPolygons,
    projectedPort: port,
  })
}
