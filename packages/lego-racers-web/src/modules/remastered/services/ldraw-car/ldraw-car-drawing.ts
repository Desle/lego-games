import {
  BRICK_DATABASE_PATH,
  getCarOrigin,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import { Group, Mesh } from 'three'
import type { Object3D } from 'three'
import type { LDrawDetail } from '../ldraw-library/ldraw-library-loader.types.ts'
import { createDetailedBody } from './detailed-body.ts'
import { getBodyColoredDesign, getIsLDrawBrick } from './brick-body-color.ts'
import { createGameBrickMeshes, getGameBrickMaterials } from './game-brick-meshes.ts'
import { loadDesignGridOffset } from './chassis-grid-offset-loader.ts'
import { getDeckRestedDesign } from './deck-rested-design.ts'
import {
  createLDrawCarDocument,
  getChassisFileName,
  LDRAW_TO_STUDS,
  LDRAW_UNITS_PER_STUD,
} from './ldraw-car-document.ts'
import { createStudioLights } from './ldraw-plastic.ts'
import type { PlasticMesh } from './ldraw-plastic.types.ts'
import type { BodyWheel } from './detailed-body.types.ts'
import type { LDrawCarDrawing, LDrawCarRequest } from './ldraw-car-drawing.types.ts'

const NO_CHASSIS_MODELS: ReadonlyMap<string, string> = new Map()
// How far (studs) a print of the original is laid out from its brick's face, so it shows on the LDraw part's face.
const DECAL_LIFT = 0.02

const getIsPlasticMesh = (object: Object3D): object is PlasticMesh => object instanceof Mesh

const disposeMeshes = (group: Group) => {
  for (const child of group.children.filter(getIsPlasticMesh)) {
    child.geometry.dispose()
    child.material.dispose()
  }
}

// The car of a design as LDraw parts, in the frame of the mesh the original builds (studs, z up, the car's origin at 0). The
// bricks without an LDraw part show the game's own mesh at once, and so do the others (in the library's plastic) until the
// library has delivered their parts. When it cannot (no library on the dev server), the whole car stays the game's mesh.
export const createLDrawCarDrawing = (
  { archive, design }: LDrawCarRequest,
  isLDrawUsed = true,
  chassisModels: ReadonlyMap<string, string> = NO_CHASSIS_MODELS,
  onWheels: ((wheels: readonly BodyWheel[], detail: LDrawDetail) => void) | null = null,
  isStudioIncluded = true
): LDrawCarDrawing => {
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const origin = getCarOrigin(database, design)
  const chassisReferences = new Set(chassisModels.keys())
  const brickDocument = createLDrawCarDocument(design, origin, chassisReferences)
  const document = Object.freeze({
    ...brickDocument,
    text: [
      brickDocument.text,
      ...[...chassisModels].map(([name, text]) => `0 FILE ${getChassisFileName(name)}\n${text}`),
    ].join('\n'),
  })
  const object = new Group()
  if (isStudioIncluded) object.add(createStudioLights())
  const gameBricks = isLDrawUsed ? document.unmappedBricks : design.bricks
  const gameMeshes = createGameBrickMeshes(archive, database, gameBricks, origin)
  object.add(gameMeshes)
  const mappedBricks = design.bricks.filter((brick) => !document.unmappedBricks.includes(brick))
  const placeholder = createGameBrickMeshes(archive, database, mappedBricks, origin)
  if (isLDrawUsed) object.add(placeholder)
  const draw = async () => {
    const gridOffset = await loadDesignGridOffset(design, chassisModels)
    const builtDesign = getBodyColoredDesign(
      database,
      getGameBrickMaterials(archive),
      chassisModels.size === 0 ? design : getDeckRestedDesign(design)
    )
    const shiftedDocument = createLDrawCarDocument(
      builtDesign,
      origin,
      chassisReferences,
      gridOffset
    )
    const restedGameMeshes = createGameBrickMeshes(
      archive,
      database,
      shiftedDocument.unmappedBricks,
      origin
    )
    const prints = createGameBrickMeshes(
      archive,
      database,
      builtDesign.bricks.filter(getIsLDrawBrick),
      origin,
      DECAL_LIFT
    )
    object.remove(gameMeshes)
    disposeMeshes(gameMeshes)
    for (const meshes of [restedGameMeshes, prints]) {
      object.add(meshes)
      meshes.position.set(
        gridOffset.x / LDRAW_UNITS_PER_STUD,
        gridOffset.z / LDRAW_UNITS_PER_STUD,
        -gridOffset.y / LDRAW_UNITS_PER_STUD
      )
    }
    const body = createDetailedBody(
      [
        shiftedDocument.text,
        ...[...chassisModels].map(([name, text]) => `0 FILE ${getChassisFileName(name)}\n${text}`),
      ].join('\n'),
      onWheels
    )
    await body.shown
    const holder = new Group()
    holder.matrixAutoUpdate = false
    holder.matrix.copy(LDRAW_TO_STUDS)
    holder.add(body.object)
    object.add(holder)
    object.remove(placeholder)
    disposeMeshes(placeholder)
    return body
  }
  const drawn = isLDrawUsed
    ? draw().catch((error: unknown) => {
        console.error(
          'The LDraw library could not build the car; drawing the original bricks',
          error
        )
        return null
      })
    : Promise.resolve(null)
  return Object.freeze({
    object,
    document,
    origin,
    shown: drawn.then(() => undefined),
    settled: drawn.then((body) => body?.refined()),
  })
}
