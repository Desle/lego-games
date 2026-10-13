import { LDrawParticleKind } from './ldraw-particle-mappings.types.ts'
import type {
  LDrawParticleMaterial,
  LDrawParticlePart,
  LDrawParticleReference,
} from './ldraw-particle-mappings.types.ts'

const ROUND_PLATE = '4073'
const ROUND_TILE = '98138'

// Smoke is a smooth round tile, everything else a round plate, in the LDraw colour nearest what the original's material shows.
export const LDRAW_PARTICLE_PARTS: Readonly<Record<LDrawParticleKind, LDrawParticlePart>> =
  Object.freeze({
    [LDrawParticleKind.SMOKE]: { partName: ROUND_TILE, colorCode: 71 },
    [LDrawParticleKind.WHITE_SMOKE]: { partName: ROUND_TILE, colorCode: 15 },
    [LDrawParticleKind.DARK_SMOKE]: { partName: ROUND_TILE, colorCode: 72 },
    [LDrawParticleKind.DUST]: { partName: ROUND_PLATE, colorCode: 28 },
    [LDrawParticleKind.SAND]: { partName: ROUND_PLATE, colorCode: 19 },
    [LDrawParticleKind.SPARKS]: { partName: ROUND_PLATE, colorCode: 46 },
    [LDrawParticleKind.HOT_SPARKS]: { partName: ROUND_PLATE, colorCode: 57 },
    [LDrawParticleKind.WATER]: { partName: ROUND_PLATE, colorCode: 43 },
    [LDrawParticleKind.GRASS]: { partName: ROUND_PLATE, colorCode: 2 },
    [LDrawParticleKind.SWAMP]: { partName: ROUND_PLATE, colorCode: 330 },
    [LDrawParticleKind.SNOW]: { partName: ROUND_TILE, colorCode: 15 },
  })

const COMMON = 'GAMEDATA\\COMMON'
const COMMON_EMITTERS = `${COMMON}\\EMITTER.EMB`

const getTrackReference = (
  track: string,
  materialName: string,
  emitterName: string
): LDrawParticleReference =>
  Object.freeze({
    directory: `GAMEDATA\\RACE${track}`,
    library: `EMIT${track}`,
    materialName,
    emitterPath: `GAMEDATA\\RACE${track}\\RACE${track}.EMB`,
    emitterName,
  })

const getCommonReference = (materialName: string, emitterName: string): LDrawParticleReference =>
  Object.freeze({
    directory: COMMON,
    library: 'EMITTER',
    materialName,
    emitterPath: COMMON_EMITTERS,
    emitterName,
  })

// The builder's reference of each kind: the first row of its most seen material and an emitter that draws it. Dark smoke's
// `cbsmoke` has no emitter of its own in the files; its card takes the lava smoke's size (`lavasmk`, the kind's other material).
export const LDRAW_PARTICLE_REFERENCES: Readonly<
  Record<LDrawParticleKind, LDrawParticleReference>
> = Object.freeze({
  [LDrawParticleKind.SMOKE]: getCommonReference('smoke1', 'carsmke'),
  [LDrawParticleKind.WHITE_SMOKE]: getCommonReference('tbsmoke1', 'trbsmke'),
  [LDrawParticleKind.DARK_SMOKE]: {
    ...getTrackReference('C0R1', 'cbsmoke1', 'lavasmk'),
    emitterPath: 'GAMEDATA\\RACEC0R3\\RACEC0R3.EMB',
  },
  [LDrawParticleKind.DUST]: getCommonReference('dust1', 'dust'),
  [LDrawParticleKind.SAND]: getTrackReference('C0R2', 'sandpart', 'sandemt'),
  [LDrawParticleKind.SPARKS]: getCommonReference('carspar1', 'carsprk'),
  [LDrawParticleKind.HOT_SPARKS]: getCommonReference('brlspar1', 'dynsprk'),
  [LDrawParticleKind.WATER]: getTrackReference('C0R2', 'waterprt', 'wateremt'),
  [LDrawParticleKind.GRASS]: getTrackReference('C0R0', 'graspart', 'grassemt'),
  [LDrawParticleKind.SWAMP]: getTrackReference('C1R1', 'swampprt', 'swampemt'),
  [LDrawParticleKind.SNOW]: getTrackReference('C1R3', 'snowpart', 'snowkick'),
})

const getMaterials = (
  names: readonly string[],
  kind: LDrawParticleKind,
  solidAlpha: number
): readonly (readonly [string, LDrawParticleMaterial])[] =>
  names.map((name) => [name, Object.freeze({ kind, solidAlpha })] as const)

// The four rows of a material animation (`smoke1` .. `smoke4`): a particle takes the next as it ages, each fainter.
const getRows = (stem: string): readonly string[] =>
  [1, 2, 3, 4].map((row) => `${stem}${String(row)}`)

// The particle materials of the emitter files (`EMITTER.MDB` and the tracks' `EMITC*.MDB`), by the first row's alpha. Left to the
// original: flashes (`ltflash`, `canflash`), the explosion's and the walls' debris (`debris`, `rockpart`), lava (`lavaball`),
// leaves, bats and the magic trails (`wizardtl`, `ghosttrl`): none is a small puff or spark.
export const LDRAW_PARTICLE_MATERIALS: Readonly<Record<string, LDrawParticleMaterial>> =
  Object.freeze(
    Object.fromEntries([
      ...getMaterials(getRows('smoke'), LDrawParticleKind.SMOKE, 30),
      ...getMaterials(getRows('spsmoke'), LDrawParticleKind.SMOKE, 200),
      ...getMaterials(['dstsmoke'], LDrawParticleKind.SMOKE, 150),
      ...getMaterials(getRows('tbsmoke'), LDrawParticleKind.WHITE_SMOKE, 100),
      // The cannon's smoke: despite its name, EMITTER.MDB draws it white (diffuse 255 255 255, the smoke pictures), as the turbo's.
      ...getMaterials(getRows('dksmoke'), LDrawParticleKind.WHITE_SMOKE, 100),
      ...getMaterials(getRows('cbsmoke'), LDrawParticleKind.DARK_SMOKE, 200),
      ...getMaterials(getRows('lvsmoke'), LDrawParticleKind.DARK_SMOKE, 200),
      ...getMaterials(getRows('dust'), LDrawParticleKind.DUST, 60),
      ...getMaterials(['sandpart'], LDrawParticleKind.SAND, 75),
      ...getMaterials(['candust'], LDrawParticleKind.SAND, 100),
      ...getMaterials(getRows('carspar'), LDrawParticleKind.SPARKS, 255),
      ...getMaterials(getRows('brlspar'), LDrawParticleKind.HOT_SPARKS, 255),
      ...getMaterials(['waterprt'], LDrawParticleKind.WATER, 150),
      ...getMaterials(['bubbles'], LDrawParticleKind.WATER, 200),
      ...getMaterials(getRows('bubble'), LDrawParticleKind.WATER, 255),
      ...getMaterials(getRows('watmist'), LDrawParticleKind.WATER, 100),
      ...getMaterials(['graspart'], LDrawParticleKind.GRASS, 200),
      ...getMaterials(['swampprt'], LDrawParticleKind.SWAMP, 200),
      ...getMaterials(['snowpart', 'snowflak'], LDrawParticleKind.SNOW, 255),
    ])
  )
