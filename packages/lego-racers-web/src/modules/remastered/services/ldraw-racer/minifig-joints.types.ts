import type { MinifigPartKey } from './minifig-assembly.types.ts'

// Where a part hangs on the figure: the part it turns with, and the point of the figure's frame (LDraw axes and units) it turns about.
export type MinifigJoint = {
  readonly parentKey: MinifigPartKey | null
  readonly pivot: readonly [number, number, number]
}
