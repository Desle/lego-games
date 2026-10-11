import { parseAnimation } from '../../../animation/index.ts'
import { createEmitterPool, parseEmitters } from '../../../emitter/index.ts'
import type { EmitterPool } from '../../../emitter/index.ts'
import { parseMaterialAnimation } from '../../../material-animation/index.ts'
import type { MaterialAnimation } from '../../../material-animation/index.ts'
import type { RaceDescription } from '../../../race-description/index.ts'
import { getSkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { TrackEmitters } from '../../../track-logic/index.ts'
import { readWorld } from '../../../world/index.ts'
import { createWorldAnimation, EMPTY_WORLD_ANIMATION } from '../../../world-animation/index.ts'
import type { ReadFile } from './load-race.types.ts'
import type { RaceWorlds, WorldAnimation } from '../../../world-animation/index.ts'

const JAM_SEPARATOR = '\\'
const COMMON_FOLDER = 'GAMEDATA\\COMMON'
// Emitters_Load's first argument at 0x00433e4e (race +0x2150) and 0x004334f8 (race +0x248c).
const COMMON_EMITTER_COUNT = 10
const TRACK_EMITTER_COUNT = 4

// The race description names text files (`.wdf`, `.emt`); the loaders read the binary twin, whose extension ends in b.
const getBinaryName = (name: string): string => `${name.slice(0, -1)}b`.toUpperCase()

// 0x00432e20: the world is read from its folder; the files its lists name sit in the same folder, as `.ADB` and
// `.MAB` (the list loader replaces the `.adf` and `.maf` it appends).
const loadWorldAnimation = (readFile: ReadFile, folder: string, name: string): WorldAnimation => {
  const world = readWorld(readFile(`${folder}${JAM_SEPARATOR}${getBinaryName(name)}`))
  return createWorldAnimation({
    world,
    animations: world.animations.map((animation) =>
      getSkeletalAnimation(
        parseAnimation(readFile(`${folder}${JAM_SEPARATOR}${animation.toUpperCase()}.ADB`))
      )
    ),
    materialAnimations: world.materialAnimations.map((animation) =>
      parseMaterialAnimation(readFile(`${folder}${JAM_SEPARATOR}${animation.toUpperCase()}.MAB`))
    ),
  })
}

// The track, blended and local worlds of a race (race +0x390, +0x398, +0x3a4).
export const loadRaceWorlds = (
  readFile: ReadFile,
  raceFolder: string,
  description: RaceDescription
): RaceWorlds => {
  const load = (name: string | null): WorldAnimation =>
    name === null ? EMPTY_WORLD_ANIMATION : loadWorldAnimation(readFile, raceFolder, name)
  return Object.freeze({
    track: load(description.trackWorld),
    blended: load(description.blendedWorld),
    local: load(description.localWorld),
  })
}

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
