import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// The detail of a model's studs: with the LEGO logo (at the logo level the page asks for) or plain. A logo stud is some twenty times the
// triangles and lines of a plain one and a car has dozens, but its logo is under a few pixels unless the car is close.
export const LDrawDetail = createEnum({
  HIGH: 'high',
  LOW: 'low',
})
export type LDrawDetail = EnumValues<typeof LDrawDetail>
