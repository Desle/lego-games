import {
  BRICK_DATABASE_PATH,
  getCarOrigin,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import { Group, Matrix4, Mesh } from 'three'
import type { Object3D } from 'three'
import type { BuiltCarDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { createGameBrickMeshes } from './game-brick-meshes.ts'
import {
  createLDrawCarDocument,
  LDRAW_TO_GAME,
  LDRAW_UNITS_PER_STUD,
} from './ldraw-car-document.ts'
import { applyPlasticLook, createStudioLights } from './ldraw-plastic.ts'
import type { PlasticMesh } from './ldraw-plastic.types.ts'
import type { LDrawCarDrawing, LDrawCarDrawingOptions } from './ldraw-car-drawing.types.ts'

const LDRAW_TO_STUDS = new Matrix4()
  .makeScale(1 / LDRAW_UNITS_PER_STUD, 1 / LDRAW_UNITS_PER_STUD, 1 / LDRAW_UNITS_PER_STUD)
  .multiply(LDRAW_TO_GAME)

const DEFAULT_OPTIONS: LDrawCarDrawingOptions = Object.freeze({ origin: null, extraText: '' })

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
  { archive, design }: BuiltCarDrawingRequest,
  isLDrawUsed = true,
  options: LDrawCarDrawingOptions = DEFAULT_OPTIONS
): LDrawCarDrawing => {
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const origin = options.origin ?? getCarOrigin(database, design)
  const brickDocument = createLDrawCarDocument(design, origin)
  const document = Object.freeze({
    ...brickDocument,
    text: [brickDocument.text, options.extraText].filter((text) => text !== '').join('\n'),
  })
  const object = new Group()
  object.add(createStudioLights())
  const gameBricks = isLDrawUsed ? document.unmappedBricks : design.bricks
  object.add(createGameBrickMeshes(archive, database, gameBricks, origin))
  const mappedBricks = design.bricks.filter((brick) => !document.unmappedBricks.includes(brick))
  const placeholder = createGameBrickMeshes(archive, database, mappedBricks, origin)
  if (isLDrawUsed) object.add(placeholder)
  const settled = isLDrawUsed
    ? parseLDrawModel(document.text).then(
        (model) => {
          applyPlasticLook(model)
          const holder = new Group()
          holder.matrixAutoUpdate = false
          holder.matrix.copy(LDRAW_TO_STUDS)
          holder.add(model)
          object.add(holder)
          object.remove(placeholder)
          disposeMeshes(placeholder)
        },
        (error: unknown) =>
          console.error(
            'The LDraw library could not build the car; drawing the original bricks',
            error
          )
      )
    : Promise.resolve()
  return Object.freeze({ object, document, origin, settled })
}
