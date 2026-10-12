import type { CarVertex } from '@lego-games/lego-racers/car-builder'

// One triangle of a chassis part, with the LDraw colour code it is drawn in (16: the colour the chassis is placed in).
export type ChassisTriangle = {
  readonly colorCode: number
  readonly vertices: readonly CarVertex[]
}
