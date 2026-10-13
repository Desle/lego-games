import { Box3, Vector3 } from 'three'
import { ReferenceShape } from './builder-reference.types.ts'

// A mesh whose smallest extent is under this share of its largest is a flat card (a trail, a ring): its shape is no build guide.
const FLAT_EXTENT_SHARE = 1 / 3
const MINIMUM_GRID_STUDS = 8
const GRID_MARGIN_STUDS = 2
const EMPTY_POWER_UP_AREA = new Box3(new Vector3(-2, -2, 0), new Vector3(2, 2, 2))
const EMPTY_CAR_AREA = new Box3(new Vector3(-4, -3, -1.5), new Vector3(4, 3, 1.5))

const getExtents = (bounds: Box3): readonly number[] => bounds.getSize(new Vector3()).toArray()

// A power-up object's original as a build guide: nothing when it shows nothing, an effect when the race poses none of its triangles,
// draws it see-through or it is flat, else solid.
export const getPowerUpReferenceShape = (
  posedBounds: Box3,
  shownBounds: Box3,
  isSeeThrough: boolean
): ReferenceShape => {
  if (shownBounds.isEmpty() || Math.max(...getExtents(shownBounds)) <= 0) return ReferenceShape.NONE
  const extents = getExtents(posedBounds)
  const isFlat =
    posedBounds.isEmpty() || Math.min(...extents) < Math.max(...extents) * FLAT_EXTENT_SHARE
  return isFlat || isSeeThrough ? ReferenceShape.EFFECT : ReferenceShape.SOLID
}

// The side of a power-up object's square build grid (even, so a line runs through the origin): the reference's footprint about the
// origin and a margin, never under a few studs.
export const getPowerUpGridStuds = (bounds: Box3 | null): number => {
  if (bounds === null || bounds.isEmpty()) return MINIMUM_GRID_STUDS
  const reach = Math.max(
    Math.abs(bounds.min.x),
    Math.abs(bounds.max.x),
    Math.abs(bounds.min.y),
    Math.abs(bounds.max.y)
  )
  return Math.max(MINIMUM_GRID_STUDS, 2 * (Math.ceil(reach) + GRID_MARGIN_STUDS))
}

// What the camera frames when there are no parts and no reference: a power-up object's few studs, else a car's.
export const getEmptyBuildArea = (isPowerUp: boolean): Box3 =>
  (isPowerUp ? EMPTY_POWER_UP_AREA : EMPTY_CAR_AREA).clone()
