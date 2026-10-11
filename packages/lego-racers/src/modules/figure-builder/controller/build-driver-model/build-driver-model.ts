import { getDrawBatches } from '../../../scene/index.ts'
import type {
  BodyPartCatalog,
  DriverBatch,
  DriverModel,
  GeometryPart,
  PartGeometry,
} from '../../types/figure-builder.types.ts'
import type { DriverModelRequest } from '../../types/driver-model-request.types.ts'

// The material names of the body model that a driver's own materials replace (0x0049d9b0 called with "face", "torso" and
// "legs" from 0x0049dab0).
const FACE_MATERIAL = 'face'
const TORSO_MATERIAL = 'torso'
const LEGS_MATERIAL = 'legs'
// The tint 0x0049d2a0 gives both colours of those materials: 200, 200, 200 and an opaque alpha.
const REPLACED_MATERIAL_TINT: readonly [number, number, number, number] = Object.freeze([
  200, 200, 200, 255,
])
// The face texture of an expression: the head's prefix and the first expression, "dflt" (catalogue +0x200).
const DEFAULT_EXPRESSION = 'dflt'
const MATERIAL_NAME_LENGTH = 8
const PART_BYTE_HAT = 0
const PART_BYTE_FACE = 1
const PART_BYTE_TORSO = 2
const PART_BYTE_LEGS = 3

const getSameName = (left: string, right: string): boolean =>
  left.slice(0, MATERIAL_NAME_LENGTH) === right.slice(0, MATERIAL_NAME_LENGTH)

const getPart = (geometry: PartGeometry, name: string): GeometryPart => {
  const part = geometry.parts.find((candidate) => getSameName(candidate.name, name))
  if (part === undefined) throw new RangeError(`The part geometry has no mesh ${name}`)
  return part
}

// The material names a driver's parts give the three replaced materials: the head prefix with the default
// expression, the torso's and the legs' (0x00498f70, 0x00498fd0, 0x00499020).
const getReplacements = (
  catalog: BodyPartCatalog,
  partBytes: readonly number[]
): ReadonlyMap<string, string> => {
  const head = catalog.heads.entries[partBytes[PART_BYTE_FACE] ?? 0]
  const torso = catalog.torsos.entries[partBytes[PART_BYTE_TORSO] ?? 0]
  const legs = catalog.legs.entries[partBytes[PART_BYTE_LEGS] ?? 0]
  if (head === undefined || torso === undefined || legs === undefined) {
    throw new RangeError('A part byte of the driver is outside the catalogue')
  }
  return new Map([
    [FACE_MATERIAL, `${head.name}${DEFAULT_EXPRESSION}`],
    [TORSO_MATERIAL, torso.name],
    [LEGS_MATERIAL, legs.name],
  ])
}

const getBatch = (
  replacements: ReadonlyMap<string, string>,
  materialName: string,
  vertexIndices: Uint32Array,
  transformIndices: Uint8Array
): DriverBatch => {
  const replacement = replacements.get(materialName)
  return Object.freeze({
    materialName: replacement ?? materialName,
    vertexIndices,
    transformIndices,
    tint: replacement === undefined ? null : REPLACED_MATERIAL_TINT,
  })
}

// 0x0049dab0 with 0x0049d920, 0x0049d970 and 0x0049dd50: the model of a driver as the race shows him. The body (`leg_box`,
// the game's box figure: face, legs, torso and arms on five bones) keeps its legs, torso and arms; its face block is dropped
// and the head and hat part of the catalogue is drawn instead, under the face bone (the bone the body's face block
// follows). The face, torso and legs materials are replaced by the driver's own (the head's `<prefix>dflt`, the torso's and
// the legs'), tinted 200, 200, 200. The vertices of the body come first, then the part's; the model keeps the body's scale.
export const buildDriverModel = (request: DriverModelRequest): DriverModel => {
  const { catalog, geometry, body, partBytes } = request
  const replacements = getReplacements(catalog, partBytes)
  const hat = getPart(geometry, catalog.hatMeshNames[partBytes[PART_BYTE_HAT] ?? 0] ?? '')
  const bodyBuffer = body.vertexBuffer
  if (bodyBuffer === null) throw new RangeError('The body model has no vertices')
  const bodyBatches = getDrawBatches(body.commands, body.faces)
  const faceBatch = bodyBatches.find((batch) =>
    getSameName(body.materialNames[batch.materialSlot] ?? '', FACE_MATERIAL)
  )
  const faceBone = faceBatch?.transformIndices[0] ?? 0
  const bodyVertexCount = bodyBuffer.vertexCount
  const batches: DriverBatch[] = [
    ...bodyBatches
      .filter((batch) => batch !== faceBatch)
      .map((batch) =>
        getBatch(
          replacements,
          body.materialNames[batch.materialSlot] ?? '',
          batch.vertexIndices,
          batch.transformIndices
        )
      ),
    ...hat.groups.map((group) => {
      const indices = Uint32Array.from(group.triangles, (index) => index + bodyVertexCount)
      return getBatch(
        replacements,
        group.materialName,
        indices,
        new Uint8Array(indices.length).fill(faceBone)
      )
    }),
  ]
  const hatVertexCount = geometry.positions.length / 3
  const hatNormals = geometry.normals ?? new Float32Array(hatVertexCount * 3)
  return Object.freeze({
    positions: Float32Array.from([...bodyBuffer.positions, ...geometry.positions]),
    normals: Float32Array.from([...bodyBuffer.normals, ...hatNormals]),
    textureCoordinates: Float32Array.from([
      ...bodyBuffer.textureCoordinates,
      ...geometry.textureCoordinates,
    ]),
    batches: Object.freeze(batches),
    scale: body.scale,
  })
}
