import type { BodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import type { ModelScene } from '@lego-games/lego-racers/scene'

const NO_HAT = 0
const NO_EXPRESSION = 0
// The faces' pictures are named by the face's prefix and the expression (`cr_dflt`, `cr_blink`, `lh_happy`); `lh_` is the plain
// face of the figure builder, which a cinema's figure also wears under a champion's helmet.
const PLAIN_FACE_PREFIX = 'lh_'

// The names of the pictures a model's own mesh is painted with (its first instance's).
export const getModelPictureNames = (model: ModelScene): readonly string[] => {
  const { scene } = model
  const mesh = scene.meshes[scene.instances[0]?.levels[0]?.meshIndex ?? -1]
  if (mesh === undefined) return []
  return [
    ...new Set(
      mesh.materialIndices.flatMap((materialIndex) => {
        const textureIndex = scene.materials[materialIndex]?.textureIndex ?? null
        const name = textureIndex === null ? undefined : scene.textures[textureIndex]?.name
        return name === undefined ? [] : [name.toLowerCase()]
      })
    ),
  ]
}

// The face a figure wears: the prefix most of its face pictures have, a champion's before the plain one.
const getFaceIndex = (catalog: BodyPartCatalog, pictureNames: readonly string[]): number => {
  const counts = catalog.heads.entries.map(
    (entry) =>
      pictureNames.filter((name) => name.startsWith(entry.name.toLowerCase())).length *
      (entry.name.toLowerCase() === PLAIN_FACE_PREFIX ? 1 : 2)
  )
  const best = Math.max(0, ...counts)
  return best === 0 ? -1 : counts.indexOf(best)
}

// The five part bytes (hat, face, torso, legs, expression) of a figure a world draws with a model of its own (a cinema's champion or
// the player's stand-in), read off the pictures it is painted with: the hat whose mesh name is a picture (`cr_hat`, `helmetvv`;
// none: no hat), the face of its face pictures, and the torso and legs whose material is a picture (`cr_chst`, `leg_peg`). Null when
// the pictures name no face, torso or legs (a figure that is a glow).
export const getFigurePartBytes = (
  catalog: BodyPartCatalog,
  pictureNames: readonly string[]
): readonly number[] | null => {
  const hasPicture = (name: string) => pictureNames.includes(name.toLowerCase())
  const hat = catalog.hatMeshNames.findIndex(hasPicture)
  const face = getFaceIndex(catalog, pictureNames)
  const torso = catalog.torsos.entries.findIndex((entry) => hasPicture(entry.name))
  const legs = catalog.legs.entries.findIndex((entry) => hasPicture(entry.name))
  if (face < 0 || torso < 0 || legs < 0) return null
  return Object.freeze([hat < 0 ? NO_HAT : hat, face, torso, legs, NO_EXPRESSION])
}
