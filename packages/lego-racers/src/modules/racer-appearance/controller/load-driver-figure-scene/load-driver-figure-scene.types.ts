import type { BodyPartCatalog } from '../../../figure-builder/index.ts'
import type { GeometryBones } from '../../../scene/index.ts'

// What differs between the figure builder's two modes (0x0049db90): where the parts and the body are, and the skeleton
// and animations the figure follows.
export type DriverFigureFiles = {
  readonly catalog: BodyPartCatalog
  readonly geometryPath: string
  // The body model's `.GDB` path.
  readonly bodyPath: string
  readonly bones: GeometryBones
}
