import { LDrawParticleKind } from './ldraw-particle-mappings.types.ts'
import type { LDrawParticleMaterial, LDrawParticlePart } from './ldraw-particle-mappings.types.ts'

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
