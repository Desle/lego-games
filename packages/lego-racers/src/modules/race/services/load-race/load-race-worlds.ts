import { parseAnimation } from '../../../animation/index.ts'
import { createEmitterPool, parseEmitters } from '../../../emitter/index.ts'
import type { EmitterPool } from '../../../emitter/index.ts'
import { parseMaterialAnimation } from '../../../material-animation/index.ts'
import type { MaterialAnimation } from '../../../material-animation/index.ts'
import type { RaceDescription } from '../../../race-description/index.ts'
import { parseSkeleton } from '../../../skeleton/index.ts'
import { getSkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { TrackEmitters } from '../../../track-logic/index.ts'
import { parseSky } from '../../../sky/index.ts'
import { getModelBounds, parseModel } from '../../../model/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { readWorld } from '../../../world/index.ts'
import type { World } from '../../../world/index.ts'
import {
  createWorldAnimation,
  EMPTY_WORLD_ANIMATION,
  findSkeletonInstanceIndex,
} from '../../../world-animation/index.ts'
import { loadGhostCar } from '../../../ghost/index.ts'
import type { GhostSession } from '../../../ghost/index.ts'
import type { RaceSkyDefinition } from '../../types/race.types.ts'
import type { MeshMeasures, ReadFile } from './load-race.types.ts'
import type { RaceWorlds, WorldAnimation } from '../../../world-animation/index.ts'

const MODEL_ARITHMETIC = createFloatArithmetic(RACE_FPU_PRECISION)
const JAM_SEPARATOR = '\\'
const COMMON_FOLDER = 'GAMEDATA\\COMMON'
// Emitters_Load's first argument at 0x00433e4e (race +0x2150) and 0x004334f8 (race +0x248c).
const COMMON_EMITTER_COUNT = 10
const TRACK_EMITTER_COUNT = 4

// The race description names text files (`.wdf`, `.emt`); the loaders read the binary twin, whose extension ends in b.
const getBinaryName = (name: string): string => `${name.slice(0, -1)}b`.toUpperCase()

// The scale (model +0x38) and the bounding radius (+0x34) of the models the skeleton instances show: an emitter that
// follows one of their bones scales the bone's position by the scale, and a hazard's collision sphere takes the radius.
// Models no skeleton instance uses keep 1 and 0.
const getMeshMeasures = (readFile: ReadFile, folder: string, world: World): MeshMeasures => {
  const used = new Set(
    world.skeletonInstances.flatMap((instance) =>
      instance.levels.map((level) => level.meshIndex).filter((index) => index >= 0)
    )
  )
  const models = world.meshes.map((mesh, index) =>
    used.has(index)
      ? parseModel(readFile(`${folder}${JAM_SEPARATOR}${mesh.toUpperCase()}.GDB`))
      : null
  )
  return {
    scales: models.map((model) => model?.scale ?? 1),
    radii: models.map((model) =>
      model === null ? 0 : (getModelBounds(MODEL_ARITHMETIC, model)?.radius ?? 0)
    ),
  }
}

// 0x00432e20: the world is read from its folder; the files its lists name sit in the same folder, as `.ADB` and
// `.MAB` (the list loader replaces the `.adf` and `.maf` it appends).
const loadWorldAnimation = (
  readFile: ReadFile,
  folder: string,
  name: string,
  isMirrored = false
): WorldAnimation => {
  const world = readWorld(readFile(`${folder}${JAM_SEPARATOR}${getBinaryName(name)}`))
  const measures = getMeshMeasures(readFile, folder, world)
  return createWorldAnimation({
    world,
    isMirrored,
    animations: world.animations.map((animation) =>
      getSkeletalAnimation(
        parseAnimation(readFile(`${folder}${JAM_SEPARATOR}${animation.toUpperCase()}.ADB`))
      )
    ),
    meshScales: measures.scales,
    meshRadii: measures.radii,
    skeletons: world.skeletons.map((skeleton) =>
      parseSkeleton(readFile(`${folder}${JAM_SEPARATOR}${skeleton.toUpperCase()}.SDB`))
    ),
    materialAnimations: world.materialAnimations.map((animation) =>
      parseMaterialAnimation(readFile(`${folder}${JAM_SEPARATOR}${animation.toUpperCase()}.MAB`))
    ),
  })
}

const GHOST_WORLD_NAME = 'ghost.wdf'
const GHOST_WHEELS_NAME = 'ghost2'
const GHOST_DRIVER_NAME = 'ghostdr'

// Ghost_Initialize 0x00422420 loads the `ghost` world of GAMEDATA\COMMON once per session and keeps its wheels and driver
// skeleton instances; a ghost that has them already (a later race of the session) keeps them, and so their clocks.
export const loadRaceGhost = (
  readFile: ReadFile,
  ghost: GhostSession | null | undefined
): GhostSession | null => {
  if (ghost === null || ghost === undefined) return null
  if (ghost.championCar !== null) return ghost
  const world = loadWorldAnimation(readFile, COMMON_FOLDER, GHOST_WORLD_NAME)
  const wheels = world.skeletonInstances[findSkeletonInstanceIndex(world, GHOST_WHEELS_NAME)]
  const driver = world.skeletonInstances[findSkeletonInstanceIndex(world, GHOST_DRIVER_NAME)]
  return wheels === undefined || driver === undefined
    ? ghost
    : loadGhostCar(ghost, { wheels, driver })
}

// The track, blended and local worlds of a race (race +0x390, +0x398, +0x3a4).
export const loadRaceWorlds = (
  readFile: ReadFile,
  raceFolder: string,
  description: RaceDescription,
  isMirrored: boolean
): RaceWorlds => {
  const load = (name: string | null): WorldAnimation =>
    name === null
      ? EMPTY_WORLD_ANIMATION
      : loadWorldAnimation(readFile, raceFolder, name, isMirrored)
  return Object.freeze({
    track: load(description.trackWorld),
    blended: load(description.blendedWorld),
    local: load(description.localWorld),
  })
}

// Sky_Load 0x0041c550: the sky file and the background world it loads; a race without a sky file has neither.
export const loadRaceSky = (
  readFile: ReadFile,
  raceFolder: string,
  description: RaceDescription
): RaceSkyDefinition | undefined =>
  description.sky === null
    ? undefined
    : Object.freeze({
        sky: parseSky(readFile(`${raceFolder}${JAM_SEPARATOR}${getBinaryName(description.sky)}`)),
        background:
          description.backgroundWorld === null
            ? EMPTY_WORLD_ANIMATION
            : loadWorldAnimation(readFile, raceFolder, description.backgroundWorld),
      })

// The first material animation of a world (`world->vtable +0x4c (0)`), which is what Emitters_Load's fourth
// argument is: the table the particles' entries index.
const loadFirstMaterialAnimation = (
  readFile: ReadFile,
  folder: string,
  worldName: string | null
): MaterialAnimation | null => {
  if (worldName === null) return null
  const world = readWorld(readFile(`${folder}${JAM_SEPARATOR}${getBinaryName(worldName)}`))
  const first = world.materialAnimations[0]
  return first === undefined
    ? null
    : parseMaterialAnimation(readFile(`${folder}${JAM_SEPARATOR}${first.toUpperCase()}.MAB`))
}

const loadEmitterPool = (
  readFile: ReadFile,
  folder: string,
  name: string | null,
  instanceCount: number,
  animation: MaterialAnimation | null
): EmitterPool | null =>
  name === null
    ? null
    : createEmitterPool({
        list: parseEmitters(readFile(`${folder}${JAM_SEPARATOR}${getBinaryName(name)}`)),
        instanceCount,
        animation,
      })

// The common emitter file with the global world's first material animation, and the track's own with the local
// world's (Race_LoadTrackContent 0x00433480).
export const loadRaceEmitters = (
  readFile: ReadFile,
  raceFolder: string,
  description: RaceDescription
): TrackEmitters =>
  Object.freeze({
    common: loadEmitterPool(
      readFile,
      COMMON_FOLDER,
      description.emitterDefinitions,
      COMMON_EMITTER_COUNT,
      loadFirstMaterialAnimation(readFile, COMMON_FOLDER, description.globalWorld)
    ),
    track: loadEmitterPool(
      readFile,
      raceFolder,
      description.trackEmitters,
      TRACK_EMITTER_COUNT,
      loadFirstMaterialAnimation(readFile, raceFolder, description.localWorld)
    ),
  })
