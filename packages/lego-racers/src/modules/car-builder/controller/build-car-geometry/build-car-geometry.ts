import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type {
  BrickDatabase,
  BrickPiece,
  BrickTransform,
  CarDesign,
  CarFace,
  CarGeometry,
  CarGeometryBatch,
  CarVertex,
  FaceReadState,
  PlacedBrick,
} from '../../types/car-builder.types.ts'

// Face word bits (0x0049a450): 0x3000 is 0x2000 for "one more vertex of the last face", 0x1000 for a face whose vertices
// have texture coordinates; bit 14 gives every vertex its own normal; bit 15 lets the first vertex keep the last normal.
const FACE_KIND_MASK = 0x3000
const EXTRA_VERTEX_KIND = 0x2000
const TEXTURED_KIND = 0x1000
const OWN_NORMALS_FLAG = 0x4000
const KEEP_NORMAL_FLAG = 0x8000
const MATERIAL_MASK = 0x7ff
const FLAGS_MASK = 0xfff
const PLATE_MATERIAL_FLAG = 0x800
const PAINTED_MATERIAL_LIMIT = 3
const PLATE_SURFACE_MATERIAL = 2
const PLATE_SURFACE_FLAGS = 2
// A face whose flags are exactly 1 is a hidden underside; the builder drops them (0x00497690 with bit 0x10).
const UNDERSIDE_FLAGS = 1
const TRIANGLE_VERTEX_COUNT = 3
const POSITION_SCALE = getFloatFromBits(0x3b800000) // 0x004b4948, 1/256
const NORMAL_SCALE = getFloatFromBits(0x3c010204) // 0x004b4934, 1/127
const TEXTURE_SCALE = getFloatFromBits(0x3a800000) // 0x004b494c, 1/1024
const BRICK_HEIGHT = getFloatFromBits(0x3ecccccd) // 0x004b0538, 0.4
const NEGATIVE_BRICK_HEIGHT = getFloatFromBits(0xbecccccd) // 0x004b4938, -0.4
const HALF = getFloatFromBits(0x3f000000) // 0x004af58c
// Pieces from 0x800 are bricks; the chassis parts below carry an origin vertex (0x0049f690).
const FIRST_BRICK_ID = 0x800
const NO_ORIGIN_VERTEX = 0xffff

const getPosition = (database: BrickDatabase, index: number): readonly [number, number, number] => [
  (database.positions[index * 3] ?? 0) * POSITION_SCALE,
  (database.positions[index * 3 + 1] ?? 0) * POSITION_SCALE,
  (database.positions[index * 3 + 2] ?? 0) * POSITION_SCALE,
]

// 0x0049a450: a vertex of a brick turned by `orientation` quarter-turns about the footprint's corner. The shape is
// `width` by `height` studs before the turn.
const getTurnedPlace = (
  point: readonly [number, number],
  size: readonly [number, number],
  orientation: number
): readonly [number, number] => {
  const [px, py] = point
  const [width, height] = size
  switch (orientation) {
    case 1:
      return [py, width - px]
    case 2:
      return [width - px, height - py]
    case 3:
      return [height - py, px]
    default:
      return [px, py]
  }
}

const getTurnedNormal = (
  normalX: number,
  normalY: number,
  orientation: number
): readonly [number, number] => {
  switch (orientation) {
    case 1:
      return [normalY, -normalX]
    case 2:
      return [-normalX, -normalY]
    case 3:
      return [-normalY, normalX]
    default:
      return [normalX, normalY]
  }
}

// The material a face is drawn with (0x0049a450): ids 0 to 2 are the brick's colour (id 2, the plate surface, its
// textured variant, the material after it); the other ids name a material, whose textured variant follows it when the
// face word's bit 11 says so.
const getFaceMaterialIndex = (word: number, colorMaterialIndex: number): number => {
  const material = word & MATERIAL_MASK
  if (material < PAINTED_MATERIAL_LIMIT) {
    return material === PLATE_SURFACE_MATERIAL ? colorMaterialIndex + 1 : colorMaterialIndex
  }
  return (word & PLATE_MATERIAL_FLAG) !== 0 ? material + 1 : material
}

// 0x0049a450: the faces of one brick with their vertices in the brick's place (z still in brick units). A face
// record is a word (kind, flags, material) followed, for each vertex, by its position index, a normal index if the
// vertex has its own (or is the first and the word's bit 15 is clear) and a texture coordinate index if the face is
// textured. A record of kind 0x2000 adds one more vertex to the face before it, making a quad.
export const getBrickFaces = (
  database: BrickDatabase,
  piece: BrickPiece,
  transform: BrickTransform,
  colorMaterialIndex: number
): readonly CarFace[] => {
  const size: readonly [number, number] = [piece.footprint.width, piece.footprint.height]
  const orientation = transform.orientation & 3
  const words = database.faceWords
  const faces: CarFace[] = []
  let cursor = piece.geometryOffset
  let state: FaceReadState = {
    isTextured: false,
    isNormalPerVertex: false,
    normalIndex: 0,
  }
  const readVertex = (positionIndex: number, flags: number, isNormalRead: boolean): CarVertex => {
    if (isNormalRead) {
      state = { ...state, normalIndex: words[cursor] ?? 0 }
      cursor += 1
    }
    const [px, py, pz] = getPosition(database, positionIndex)
    const [turnedX, turnedY] = getTurnedPlace([px, py], size, orientation)
    const normalBase = state.normalIndex * 3
    const [normalX, normalY] = getTurnedNormal(
      (database.normals[normalBase] ?? 0) * NORMAL_SCALE,
      (database.normals[normalBase + 1] ?? 0) * NORMAL_SCALE,
      orientation
    )
    let u = 0
    let v = 0
    if (state.isTextured) {
      const textureIndex = words[cursor] ?? 0
      cursor += 1
      u = (database.textureCoordinates[textureIndex * 2] ?? 0) * TEXTURE_SCALE
      v = (database.textureCoordinates[textureIndex * 2 + 1] ?? 0) * TEXTURE_SCALE
    } else if (flags === PLATE_SURFACE_FLAGS || (flags & PLATE_MATERIAL_FLAG) !== 0) {
      u = Math.fround(turnedX * BRICK_HEIGHT)
      v = Math.fround(turnedY * BRICK_HEIGHT)
    }
    return {
      x: turnedX + transform.x,
      y: turnedY + transform.y,
      z: pz + transform.baseHeight,
      normalX,
      normalY,
      normalZ: (database.normals[normalBase + 2] ?? 0) * NORMAL_SCALE,
      u,
      v,
    }
  }
  for (let record = 0; record < piece.faceRecordCount; record += 1) {
    const word = words[cursor] ?? 0
    cursor += 1
    const lastFace = faces.at(-1)
    if ((word & FACE_KIND_MASK) === EXTRA_VERTEX_KIND && lastFace !== undefined) {
      const positionIndex = words[cursor] ?? 0
      cursor += 1
      const vertex = readVertex(positionIndex, lastFace.flags, state.isNormalPerVertex)
      faces[faces.length - 1] = { ...lastFace, vertices: [...lastFace.vertices, vertex] }
      continue
    }
    state = {
      isTextured: (word & FACE_KIND_MASK) === TEXTURED_KIND,
      isNormalPerVertex: (word & OWN_NORMALS_FLAG) !== 0,
      normalIndex: state.normalIndex,
    }
    const flags = word & FLAGS_MASK
    const isNormalWordPresent = (word & KEEP_NORMAL_FLAG) === 0
    const vertices = Array.from({ length: TRIANGLE_VERTEX_COUNT }, (_, vertexIndex) => {
      const positionIndex = words[cursor] ?? 0
      cursor += 1
      return readVertex(
        positionIndex,
        flags,
        isNormalWordPresent && (vertexIndex === 0 || state.isNormalPerVertex)
      )
    })
    faces.push({ vertices, materialIndex: getFaceMaterialIndex(word, colorMaterialIndex), flags })
  }
  return faces
}

// 0x0049b340 and 0x0049b740: where the car's origin lies, as the offset added to every vertex. A chassis part as the
// first brick gives its origin vertex (the car's origin is that vertex: x and y negated, z times -0.4 so that after the
// brick height scale it lies at 0). Any other first brick is centred on the middle of its extent in x and y and rests
// on z = 0.
const getOrigin = (database: BrickDatabase, design: CarDesign): Vector3 => {
  const first = design.bricks[0]
  if (first === undefined) return { x: 0, y: 0, z: 0 }
  const { piece } = first
  if (piece.id < FIRST_BRICK_ID && piece.footprint.originVertexIndex !== NO_ORIGIN_VERTEX) {
    const [px, py, pz] = getPosition(database, piece.footprint.originVertexIndex)
    return { x: -px, y: -py, z: Math.fround(pz * NEGATIVE_BRICK_HEIGHT) }
  }
  const vertices = getBrickFaces(
    database,
    piece,
    { x: 0, y: 0, baseHeight: 0, orientation: first.orientation },
    0
  ).flatMap((face) => face.vertices)
  const getExtent = (getValue: (vertex: CarVertex) => number): readonly [number, number] => [
    Math.min(...vertices.map(getValue)),
    Math.max(...vertices.map(getValue)),
  ]
  const [minimumX, maximumX] = getExtent((vertex) => vertex.x)
  const [minimumY, maximumY] = getExtent((vertex) => vertex.y)
  const [minimumZ] = getExtent((vertex) => vertex.z)
  return {
    x: -((maximumX + minimumX) * HALF) - first.x,
    y: -((maximumY + minimumY) * HALF) - first.y,
    z: -Math.fround(minimumZ * BRICK_HEIGHT) - Math.fround(first.baseHeight * BRICK_HEIGHT),
  }
}

const getVertexKey = (vertex: CarVertex): string =>
  [
    vertex.x,
    vertex.y,
    vertex.z,
    vertex.normalX,
    vertex.normalY,
    vertex.normalZ,
    vertex.u,
    vertex.v,
  ].join(',')

// The triangles of a face (0x00497690): a quad (v0, v1, v2, v3) is the triangles (v0, v1, v2) and (v2, v1, v3).
const getTriangles = (face: CarFace): readonly (readonly CarVertex[])[] => {
  const [first, second, third, fourth] = face.vertices
  if (first === undefined || second === undefined || third === undefined) return []
  return fourth === undefined
    ? [[first, second, third]]
    : [
        [first, second, third],
        [third, second, fourth],
      ]
}

// MeshBuilder_Build 0x0049b920 and MeshBuilder_WriteModel 0x0049c840 for a design: every brick's faces, the hidden
// undersides dropped, the quads cut into triangles, the vertices welded (0x00495030) and the whole car moved so its
// origin is at 0 with the brick heights scaled by 0.4. `colorMaterialIndices` maps a colour index to its material in the
// brick material library (-1 for a colour the library does not name). Not ported: the pass that clips coplanar
// rectangles of neighbouring bricks (0x00495440, hidden surfaces only), the studs the menu's builder adds (flag +0xd8
// is clear for the race car) and the vertex cache ordering (0x00497360).
export const buildCarGeometry = (
  database: BrickDatabase,
  design: CarDesign,
  colorMaterialIndices: readonly number[]
): CarGeometry => {
  const origin = getOrigin(database, design)
  const faces = design.bricks.flatMap((brick: PlacedBrick) =>
    getBrickFaces(
      database,
      brick.piece,
      { x: brick.x, y: brick.y, baseHeight: brick.baseHeight, orientation: brick.orientation },
      colorMaterialIndices[brick.colorIndex] ?? -1
    )
  )
  const vertexIndices = new Map<string, number>()
  const vertices: CarVertex[] = []
  const trianglesByMaterial = new Map<number, number[]>()
  for (const face of faces) {
    if (face.flags === UNDERSIDE_FLAGS) continue
    for (const triangle of getTriangles(face)) {
      const indices = triangle.map((vertex) => {
        const placed: CarVertex = {
          ...vertex,
          x: Math.fround(vertex.x + origin.x),
          y: Math.fround(vertex.y + origin.y),
          z: Math.fround(Math.fround(vertex.z * BRICK_HEIGHT) + origin.z),
        }
        const key = getVertexKey(placed)
        const existing = vertexIndices.get(key)
        if (existing !== undefined) return existing
        vertexIndices.set(key, vertices.length)
        vertices.push(placed)
        return vertices.length - 1
      })
      const list = trianglesByMaterial.get(face.materialIndex) ?? []
      list.push(...indices)
      trianglesByMaterial.set(face.materialIndex, list)
    }
  }
  const batches: readonly CarGeometryBatch[] = [...trianglesByMaterial.entries()]
    .sort(([left], [right]) => left - right)
    .map(([materialIndex, indices]) => ({
      materialIndex,
      vertexIndices: Uint32Array.from(indices),
    }))
  return {
    positions: Float32Array.from(vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z])),
    normals: Float32Array.from(
      vertices.flatMap((vertex) => [vertex.normalX, vertex.normalY, vertex.normalZ])
    ),
    textureCoordinates: Float32Array.from(vertices.flatMap((vertex) => [vertex.u, vertex.v])),
    batches,
  }
}
