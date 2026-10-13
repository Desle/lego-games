// The models (POWERUP.WDB) of the effects a viewer extension may draw in place of the original's, by the original's names (the
// stems of their mesh files, which the race's request carries).
export const POWER_UP_BRICK_MODEL_NAME = 'PUBRICKY'
export const ENHANCEMENT_BRICK_MODEL_NAME = 'ENHABRIK'

// Every other model of POWERUP.WDB the race draws (race-effects): the rocket, the barrel, the magnet, the curse and its two rings,
// the two explosions, the four shields, the three turbos' burns and flames, the warp's portal, and the trails the bricks draw with
// them. The grapple, the magnet's beam, the shields' insides and the debris bricks are in the world too, but the race draws none.
export const POWER_UP_OBJECT_MODEL_NAMES: readonly string[] = Object.freeze([
  'DMISSILE',
  'BARREL',
  'MAGNET04',
  'CURSE',
  'CGREEN',
  'GREEN',
  'HEDRA01',
  'SPIKEXP',
  'SHEOUT0',
  'SHEOUT1',
  'SHEOUT2',
  'SHEOUT3',
  'DT0BURN',
  'DT0FLA1',
  'DT0FLA2',
  'DT1BURN',
  'DT1FLA1',
  'DT1FLA2',
  'DT2CBURN',
  'DT2CFLA1',
  'DT2CFLA2',
  'WARPHOLE',
  'PUTRAILY',
  'ENHANER',
])

export const EFFECT_MODEL_NAMES: readonly string[] = Object.freeze([
  POWER_UP_BRICK_MODEL_NAME,
  ENHANCEMENT_BRICK_MODEL_NAME,
  ...POWER_UP_OBJECT_MODEL_NAMES,
])

// The look of a model drawn inside out before it is drawn as modelled (the shield's back faces): a drawing in place of the model
// is whole, so in place of its inside nothing is drawn.
export const BACK_FACES_VARIANT = 'back_faces'

// Where the device's alpha override (0 to 255, null when off) of a fading effect is noted on each of its meshes' `userData`, so a
// drawing in place of the model can fade with it.
export const ALPHA_OVERRIDE_KEY = 'alphaOverride'

// Where a direct child of a drawing notes the bone (an index of the model's skeleton) whose pose it follows, its matrix set by the
// race every frame: a drawing of a mesh on several bones draws a part for each (the twin turbo's two burners). A drawing without
// such a child follows, whole, the bone the mesh's first vertex hangs on.
export const POSED_BONE_KEY = 'posedBone'
