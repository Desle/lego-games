import {
  BRICK_DATABASE_PATH,
  getCarOrigin,
  parseBrickDatabase,
} from '@lego-games/lego-racers/car-builder'
import { AmbientLight, DirectionalLight, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import type { BuiltCarDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { parseLDrawModel } from '../ldraw-library/ldraw-library-loader.ts'
import { createGameBrickMeshes } from './game-brick-meshes.ts'
import {
  createLDrawCarDocument,
  LDRAW_TO_GAME,
  LDRAW_UNITS_PER_STUD,
} from './ldraw-car-document.ts'
import type { LDrawCarDrawing } from './ldraw-car-drawing.types.ts'

const AMBIENT_INTENSITY = 2.2
const KEY_LIGHT_INTENSITY = 1.7
const FILL_LIGHT_INTENSITY = 0.6
const LIGHT_DISTANCE = 100
const PLASTIC_ROUGHNESS = 0.55

const LDRAW_TO_STUDS = new Matrix4()
  .makeScale(1 / LDRAW_UNITS_PER_STUD, 1 / LDRAW_UNITS_PER_STUD, 1 / LDRAW_UNITS_PER_STUD)
  .multiply(LDRAW_TO_GAME)

// The library's plastic is glossy enough to put a hot spot on every smoothed slope.
const softenHighlights = (model: Group) => {
  const materials = new Set<MeshStandardMaterial>()
  model.traverse((child) => {
    if (child instanceof Mesh && child.material instanceof MeshStandardMaterial)
      materials.add(child.material)
  })
  for (const material of materials) material.roughness = PLASTIC_ROUGHNESS
}

const createLights = (): Group => {
  const lights = new Group()
  const key = new DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY)
  key.position.set(-LIGHT_DISTANCE * 0.5, -LIGHT_DISTANCE * 0.8, LIGHT_DISTANCE)
  const fill = new DirectionalLight(0xffffff, FILL_LIGHT_INTENSITY)
  fill.position.set(LIGHT_DISTANCE, LIGHT_DISTANCE * 0.6, LIGHT_DISTANCE * 0.3)
  lights.add(new AmbientLight(0xffffff, AMBIENT_INTENSITY), key, fill)
  return lights
}

// The car of a design as LDraw parts, in the frame of the mesh the original builds (studs, z up, the car's origin at 0). The
// bricks without an LDraw part show the game's own mesh at once; the parts appear when the library has delivered them. When it
// cannot (no library on the dev server), the whole car shows as the game's mesh.
export const createLDrawCarDrawing = (
  { archive, design }: BuiltCarDrawingRequest,
  isLDrawUsed = true
): LDrawCarDrawing => {
  const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
  const origin = getCarOrigin(database, design)
  const document = createLDrawCarDocument(design, origin)
  const object = new Group()
  object.add(createLights())
  const gameBricks = isLDrawUsed ? document.unmappedBricks : design.bricks
  object.add(createGameBrickMeshes(database, gameBricks, origin))
  const settled = isLDrawUsed
    ? parseLDrawModel(document.text).then(
        (model) => {
          softenHighlights(model)
          const holder = new Group()
          holder.matrixAutoUpdate = false
          holder.matrix.copy(LDRAW_TO_STUDS)
          holder.add(model)
          object.add(holder)
        },
        (error: unknown) => {
          console.error(
            'The LDraw library could not build the car; drawing the original bricks',
            error
          )
          const mappedBricks = design.bricks.filter(
            (brick) => !document.unmappedBricks.includes(brick)
          )
          object.add(createGameBrickMeshes(database, mappedBricks, origin))
        }
      )
    : Promise.resolve()
  return Object.freeze({ object, document, origin, settled })
}
