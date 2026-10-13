import { createBuildGrid, getCarOrigin } from '@lego-games/lego-racers/car-builder'
import type { BrickDatabase, BrickPiece } from '@lego-games/lego-racers/car-builder'
import { STUD_WIDTH } from '@lego-games/ldraw/building'

export const getReferenceNumber = (value: number): string => String(Number(value.toFixed(2)))

// Where the car's origin lies from the chassis brick's footprint corner (the recipe frame), in studs: x, y, z.
export const getChassisOrigin = (
  database: BrickDatabase,
  piece: BrickPiece
): readonly [number, number, number] => {
  const origin = getCarOrigin(database, {
    bricks: [
      { piece, x: 0, y: 0, orientation: 0, colorIndex: 0, unidentifiedValue: 0, baseHeight: 0 },
    ],
    grid: createBuildGrid(),
  })
  return [origin.x, origin.y, origin.z]
}

// The translation, in LDraw units and axes, that puts a chassis recipe in a car file (the car's frame).
export const getChassisRecipeOffset = (
  database: BrickDatabase,
  piece: BrickPiece
): readonly [number, number, number] => {
  const [x, y, z] = getChassisOrigin(database, piece)
  return [
    Number(getReferenceNumber(x * STUD_WIDTH)),
    Number(getReferenceNumber(-z * STUD_WIDTH)),
    Number(getReferenceNumber(y * STUD_WIDTH)),
  ]
}

// The line a car file places its chassis recipe with, as the reference sheets print it.
export const getChassisReferenceLine = (database: BrickDatabase, piece: BrickPiece): string =>
  `1 16 ${getChassisRecipeOffset(database, piece).map(String).join(' ')} 1 0 0 0 1 0 0 0 1 ${piece.name.toLowerCase()}.ldr`
