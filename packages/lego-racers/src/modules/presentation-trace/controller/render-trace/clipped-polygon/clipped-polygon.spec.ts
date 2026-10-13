import type {
  DrawnTriangle,
  ScreenMatrix,
  ScreenTriangle,
  WorldTriangle,
  WorldVertex,
} from '../render-trace.types.ts'
import type { DrawState } from '../render-trace.types.ts'
import { TextureOperation } from '../../../../scene/index.ts'
import type { TextureMatch } from '../texture-matching.types.ts'
import { getClippedPolygon, getIsCutPiece, getIsFragmentOfPolygon } from './clipped-polygon.ts'

const VIEWPORT = { width: 640, height: 480 }
const RACE_DEPTHS = { near: 5, far: 800 }
// w is z: a point at depth 10 lands on the pixel of its x and y.
const FLAT_MATRIX: ScreenMatrix = [10, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]
const STATE = {} as DrawState

const getVertex = (x: number, y: number, z: number): WorldVertex => ({
  x,
  y,
  z,
  u: 0,
  v: 0,
  diffuse: [255, 255, 255, 255],
})

const getTriangle = (
  corners: readonly [readonly [number, number, number], ...(readonly [number, number, number])[]]
): WorldTriangle => {
  const [first, second, third] = corners.map(([x, y, z]) => getVertex(x, y, z))
  if (first === undefined || second === undefined || third === undefined) throw new Error('corners')
  const vertices = [first, second, third] as const
  return {
    vertices,
    localVertices: vertices,
    root: 0,
    textureKey: 'road',
    state: STATE,
    source: 'road',
  }
}

const getFragment = (points: readonly (readonly [number, number])[]): DrawnTriangle => {
  const vertices = points.map(([x, y]) => ({
    x,
    y,
    reciprocalW: 1,
    u: 0,
    v: 0,
    diffuse: [255, 255, 255, 255] as const,
  }))
  return {
    vertices: vertices as unknown as ScreenTriangle,
    textureKey: 'hash',
    state: STATE,
    source: 'hash',
  }
}

const TEXTURE_MATCHES: ReadonlyMap<string, TextureMatch> = new Map([
  ['hash', { bestKey: 'road', difference: 0, acceptableKeys: ['road'] }],
])

describe('clipped polygon', () => {
  it('leaves a triangle inside the viewport alone', () => {
    // Arrange
    const triangle = getTriangle([
      [100, 100, 10],
      [100, 200, 10],
      [200, 100, 10],
    ])

    // Act
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)

    // Assert
    expect(polygon).toBeNull()
  })

  it('drops a triangle that faces away', () => {
    // Arrange
    const triangle = getTriangle([
      [100, 100, 10],
      [200, 100, 10],
      [700, 200, 10],
    ])

    // Act
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)

    // Assert
    expect(polygon).toBeNull()
  })

  it('keeps the whole triangle that reaches past the viewport, so the pieces cut from it have a parent', () => {
    // Arrange
    const triangle = getTriangle([
      [100, 100, 10],
      [100, 200, 10],
      [700, 100, 10],
    ])
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)
    const piece = getFragment([
      [100, 100],
      [100, 190],
      [640, 100],
    ])

    // Act
    const isPiece = getIsFragmentOfPolygon(
      piece,
      polygon === null ? [] : [polygon],
      TEXTURE_MATCHES
    )

    // Assert
    expect(isPiece).toBe(true)
  })

  it('does not accept a piece that lies outside the triangle', () => {
    // Arrange
    const triangle = getTriangle([
      [100, 100, 10],
      [100, 200, 10],
      [700, 100, 10],
    ])
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)
    const piece = getFragment([
      [100, 100],
      [100, 400],
      [640, 100],
    ])

    // Act
    const isPiece = getIsFragmentOfPolygon(
      piece,
      polygon === null ? [] : [polygon],
      TEXTURE_MATCHES
    )

    // Assert
    expect(isPiece).toBe(false)
  })

  it('cuts a triangle with a corner behind the camera at the near plane', () => {
    // Arrange
    const triangle = getTriangle([
      [100, 100, 10],
      [100, 200, 10],
      [300, 100, -10],
    ])

    // Act
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)

    // Assert
    expect(polygon?.corners.length).toBe(4)
  })

  it('does not accept a piece with another texture', () => {
    // Arrange
    const triangle = getTriangle([
      [100, 100, 10],
      [100, 200, 10],
      [700, 100, 10],
    ])
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)
    const piece = getFragment([
      [100, 100],
      [100, 190],
      [640, 100],
    ])

    // Act
    const isPiece = getIsFragmentOfPolygon(
      piece,
      polygon === null ? [] : [polygon],
      new Map([['hash', { bestKey: 'grass', difference: 0, acceptableKeys: ['grass'] }]])
    )

    // Assert
    expect(isPiece).toBe(false)
  })

  it('accepts a piece drawn without its texture by an untextured port triangle', () => {
    // Arrange
    const triangle = {
      ...getTriangle([
        [100, 100, 10],
        [100, 200, 10],
        [700, 100, 10],
      ]),
      textureKey: null,
    }
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)
    const piece = {
      ...getFragment([
        [100, 100],
        [100, 190],
        [640, 100],
      ]),
      state: { colorOperation: TextureOperation.SELECT_DIFFUSE } as DrawState,
    }

    // Act
    const isPiece = getIsFragmentOfPolygon(
      piece,
      polygon === null ? [] : [polygon],
      TEXTURE_MATCHES
    )

    // Assert
    expect(isPiece).toBe(true)
  })

  it('cuts a triangle that reaches past the far plane', () => {
    // Arrange
    const triangle = getTriangle([
      [100, 100, 700],
      [100, 200, 700],
      [200, 100, 900],
    ])

    // Act
    const polygon = getClippedPolygon(triangle, FLAT_MATRIX, 'world', VIEWPORT, RACE_DEPTHS)

    // Assert
    expect(polygon).not.toBeNull()
  })

  it('knows a piece by a corner on the far plane', () => {
    // Arrange
    const piece = getFragment([
      [100, 100],
      [100, 190],
      [200, 100],
    ])
    const farPiece = {
      ...piece,
      vertices: piece.vertices.map((vertex, index) => ({
        ...vertex,
        reciprocalW: index === 0 ? 1 / 800 : 1 / 300,
      })) as unknown as ScreenTriangle,
    }
    const nearPiece = {
      ...piece,
      vertices: piece.vertices.map((vertex) => ({
        ...vertex,
        reciprocalW: 1 / 300,
      })) as unknown as ScreenTriangle,
    }

    // Act
    const results = [
      getIsCutPiece(farPiece.vertices, VIEWPORT, RACE_DEPTHS),
      getIsCutPiece(nearPiece.vertices, VIEWPORT, RACE_DEPTHS),
    ]

    // Assert
    expect(results).toEqual([true, false])
  })
})
