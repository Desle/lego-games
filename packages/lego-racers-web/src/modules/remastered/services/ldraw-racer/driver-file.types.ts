import type { BuilderPart } from '@lego-games/ldraw/building'
import type { MinifigPartWithRole } from '@lego-games/ldraw/minifig'

// One part of a driver file and its role (written as `0 !RACERS ROLE <role>` before it), placed in the figure's frame (LDraw axes, the
// top of the hips, standing rest pose).
export type DriverFilePart = MinifigPartWithRole<BuilderPart>

// The driver database's record a request names: the file's name (the record's name, upper case) and the five part bytes.
export type DriverRecordMatch = {
  readonly name: string
  readonly partBytes: readonly number[]
}

// What a driver of the database is known by: its block name, the model of its race figure and its part bytes.
export type DriverRecordKey = {
  readonly name: string
  readonly modelName: string
  readonly partBytes: readonly number[]
}
