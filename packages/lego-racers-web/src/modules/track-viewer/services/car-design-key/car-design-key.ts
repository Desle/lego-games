import type { CarDesign } from '@lego-games/lego-racers/car-builder'

// One number per brick (piece, place, turn, colour and height) names a design; a car is built again when it changes.
export const getCarDesignKey = (design: CarDesign): string =>
  design.bricks
    .map((brick) =>
      [
        brick.piece.id,
        brick.x,
        brick.y,
        brick.orientation,
        brick.colorIndex,
        brick.baseHeight,
      ].join(':')
    )
    .join('|')
