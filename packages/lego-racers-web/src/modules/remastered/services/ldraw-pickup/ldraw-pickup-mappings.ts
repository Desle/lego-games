import {
  ENHANCEMENT_BRICK_MODEL_NAME,
  POWER_UP_BRICK_MODEL_NAME,
} from '../../../../shared/viewer-extensions/effect-model-names.ts'
import type { LDrawPickupMapping } from './ldraw-pickup-mappings.types.ts'

// The bricks on the track are bricks of the original's models: PUBRICKY a 1 x 3 brick (2.34 units a stud), ENHABRIK a 1 x 2 brick, both
// turned in the mesh the way its vertices lie (length along (0.71, -0.5, -0.5), width along (0.71, 0.5, 0.5), studs toward
// (0, -0.71, 0.71)); the matrices were fitted to the mesh's 24 vertices (a stud of 20 LDraw units is 2.34 units, the brick's top
// face is where LDraw puts the part's origin). The kinds' colours are those of the textures: projectile red, shield blue,
// turbo green, hazard yellow (`LEGORacers.exe` 0x0045ba90, 0x00458a80).
export const LDRAW_PICKUP_MAPPINGS: Readonly<Record<string, LDrawPickupMapping>> = Object.freeze({
  [POWER_UP_BRICK_MODEL_NAME]: Object.freeze({
    partNumber: '3622',
    matrix: Object.freeze([
      0.0827, 0, 0.0827, -0.0585, 0.0827, 0.0585, -0.0585, -0.0827, 0.0585, 0, -1.007, 1.007,
    ] as const),
    colorCodes: Object.freeze({ projectile: 4, shield: 1, turbo: 2, hazard: 14 }),
    defaultColorCode: 14,
  }),
  [ENHANCEMENT_BRICK_MODEL_NAME]: Object.freeze({
    partNumber: '3004',
    matrix: Object.freeze([
      0.0827, 0, 0.0827, -0.0585, 0.0827, 0.0585, -0.0585, -0.0827, 0.0585, 0, -0.998, 0.998,
    ] as const),
    colorCodes: Object.freeze({}),
    defaultColorCode: 15,
  }),
})
