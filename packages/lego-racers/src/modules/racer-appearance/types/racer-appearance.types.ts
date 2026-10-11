import type { Figure, FigureBounds } from '../../racer/index.ts'
import type { Vector3 } from '../../simulation-math/index.ts'

// The five files one drawn thing is made of, each named without its extension and read from GAMEDATA\COMMON: the
// texture database (.TDB), the material library (.MDB), the model (.GDB) and, for a thing with bones, the skeleton
// (.SDB) and the animation (.ADB). An empty name means the thing has none (0x0041e360 and 0x00420ef0 load whatever
// the record names).
export type ModelResourceNames = {
  readonly textureDatabaseName: string
  readonly materialLibraryName: string
  readonly modelName: string
  readonly skeletonName: string
  readonly animationName: string
}

// What a racer's car is drawn from (RacerSet_SetupRacer 0x0043b480, Chassis_CreateInstances 0x0041e360,
// Driver_CreateInstance 0x00420ef0, Champion_CreateInstance 0x0041d7a0).
export type RacerAppearance = {
  // The car body model of a champion's car (champion record, no bones); null for a car built from bricks, whose
  // model the car builder makes from its design.
  readonly bodyModel: ModelResourceNames | null
  // The chassis's first variant: the wheels, a skeleton instance whose animation 0 (forward) and 1 (backward)
  // turn them, and which is the racer's display frame.
  readonly wheelModel: ModelResourceNames
  // The chassis's second variant (vehicle +0x40), when its model name is set; no original chassis sets it.
  readonly secondWheelModel: ModelResourceNames | null
  // The driver's model, driven by the pelvis skeleton and its 18 animations; null for a car built from bricks,
  // whose driver the front end assembles from the player's parts (0x0042dfa0). (0x0043b480 falls back to a driver
  // named "bb" when the slot has no figure, but the database keeps its driver as "BB" and the lookup compares
  // case, so that branch cannot run.)
  readonly driverModel: ModelResourceNames | null
  // Vehicle +0x4c..+0x54 (chassis +0xc4): where the driver sits in the car model's frame.
  readonly seatPoint: Vector3
  // Chassis +0x50: the name 0x0043b480 writes into the car's texture database and material library entries.
  readonly sharedResourceName: string
  // 0x0043b480 copies "carshad" and the racer's index digit into the vehicle (+0x74): the blob shadow's image.
  readonly shadowImageName: string
}

// The animated figures of a racer, ready to hand to `createRacer` and `createVehicle`.
export type RacerFigures = {
  // The car body model's bounding sphere (0x100278c0), null for a car built from bricks.
  readonly bodyBounds: FigureBounds | null
  readonly wheels: Figure
  readonly secondWheels: Figure | null
  readonly driver: Figure
}

// The files a figure is built from: its animation set and the scale of its model (GDB keyword 0x33, model +0x38),
// which the figure's bounds multiply (0x0040e0b0).
export type FigureSource = {
  readonly animationBytes: Uint8Array
  readonly modelScale: number
}

export type RacerFigureSources = {
  readonly bodyBounds: FigureBounds | null
  readonly wheels: FigureSource
  readonly secondWheels: FigureSource | null
  readonly driver: FigureSource
}
