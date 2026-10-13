import {
  BRICK_DATABASE_PATH,
  getCarOrigin,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import { Group, Mesh } from 'three'
import type { Object3D } from 'three'
import { createDetailedModel, createMaterialSet } from '@lego-games/ldraw/geometry'
import { getBodyColoredDesign, getIsLDrawBrick } from './brick-body-color.ts'
import { createGameBrickMeshes, getGameBrickMaterials } from './game-brick-meshes.ts'
import { loadDesignGridOffset } from './chassis-grid-offset-loader.ts'
import { getDeckRestedDesign } from './deck-rested-design.ts'
import { loadDesignChassisDeck } from './chassis-deck-loader.ts'
import { createLDrawCarDocument, getChassisFileName, LDRAW_TO_STUDS } from './ldraw-car-document.ts'
import { createStudioLights } from '@lego-games/ldraw/material'
import type { PlasticMesh } from '@lego-games/ldraw/material'
import type { LDrawCarDrawing, LDrawCarRequest } from './ldraw-car-drawing.types.ts'
import { STUD_WIDTH } from '@lego-games/ldraw/building'

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
  let isReleased = false
  let releaseBody: () => void = () => undefined
  const draw = async () => {
    const deck = await loadDesignChassisDeck(design, chassisModels)
    const gridOffset = deck?.gridOffset ?? (await loadDesignGridOffset(design, chassisModels))
    const builtDesign = getBodyColoredDesign(
      database,
      getGameBrickMaterials(archive),
      chassisModels.size === 0 ? design : getDeckRestedDesign(design, deck)
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
        gridOffset.x / STUD_WIDTH,
        gridOffset.z / STUD_WIDTH,
        -gridOffset.y / STUD_WIDTH
      )
    }
    const body = createDetailedModel(
      [
        shiftedDocument.text,
        ...[...chassisModels].map(([name, text]) => `0 FILE ${getChassisFileName(name)}\n${text}`),
      ].join('\n'),
      { materials: createMaterialSet(), onInstance: null, onSubModels: null }
    )
    releaseBody = body.release
    if (isReleased) body.release()
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
    release: () => {
      isReleased = true
      releaseBody()
    },
  })
}
