import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getBuiltRacerAppearance,
  getRacerModelFiles,
} from '@lego-games/lego-racers/racer-appearance'
import { readRacerDatabases } from '@lego-games/lego-racers/race'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import type { RacerDrawingPart } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'

// Ids from 0x800 are the builder's own bricks; the lower ones are chassis parts (0x0049c6a0).
const FIRST_BUILDER_BRICK_ID = 0x800

// The name of the chassis a design stands on (its chassis part's piece, such as `KKCHAS0`), null for a design with none placed.
export const getDesignChassisName = (design: CarDesign): string | null =>
  design.bricks.find((brick) => brick.piece.id < FIRST_BUILDER_BRICK_ID)?.piece.name ?? null

// The chassis database names its records in lower case, the brick database's pieces in upper case.
// The wheels of a chassis (Chassis_CreateInstances 0x0041e360: a skeleton instance whose clip 0 is the wheels turning forward) in
// the files the race reads.
const wheelsByArchive = new WeakMap<JamArchive, Map<string, RacerDrawingPart>>()

const readChassisWheels = (archive: JamArchive, chassisName: string): RacerDrawingPart => {
  const names = getBuiltRacerAppearance(
    readRacerDatabases(archive.readFile),
    chassisName.toLowerCase(),
    0
  ).wheelModel
  return {
    model: loadModelScene(archive, getRacerModelFiles(names)),
    modelName: names.modelName,
    partBytes: null,
  }
}

// The same wheels for the same chassis: the builder asks for them at every brick the player places.
export const loadChassisWheels = (archive: JamArchive, chassisName: string): RacerDrawingPart => {
  const cached = wheelsByArchive.get(archive) ?? new Map<string, RacerDrawingPart>()
  wheelsByArchive.set(archive, cached)
  const key = chassisName.toLowerCase()
  const wheels = cached.get(key) ?? readChassisWheels(archive, chassisName)
  cached.set(key, wheels)
  return wheels
}
