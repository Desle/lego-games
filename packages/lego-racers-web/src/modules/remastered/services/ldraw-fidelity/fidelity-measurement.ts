import type { Box3 } from 'three'
import { Matrix3, Vector3 } from 'three'
import {
  compareSilhouettes,
  FIDELITY_PASS_SCORE,
  getCoverageMask,
  getFidelityScore,
  getMeanColorDifference,
} from './fidelity-metrics.ts'
import type { SilhouetteComparison } from './fidelity-metrics.types.ts'
import type { ViewPictures } from './fidelity-render.types.ts'
import type {
  FidelityAnchorResult,
  FidelityItem,
  FidelityResult,
  FidelityViewResult,
} from './ldraw-fidelity.types.ts'

const LDRAW_UNITS_PER_STUD = 20
const MINIMUM_EXTENT = 1e-6
const AXIS_COUNT = 3

const getRounded = (value: number, digits = 3): number => Number(value.toFixed(digits))

const getMean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length

// The 3D offset of the replacement's centre of area from the original's, studs: each view sees the offset along its picture's x and y,
// and the offset that agrees best with all of them (least squares) is the answer.
const getCentroidOffset = (
  pictures: readonly ViewPictures[],
  comparisons: readonly SilhouetteComparison[]
): Vector3 => {
  const normal = new Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0)
  const projected = new Vector3()
  const normalElements = normal.elements
  for (const [index, picture] of pictures.entries()) {
    const comparison = comparisons[index]
    if (comparison === undefined || comparison.originalArea === 0) continue
    if (comparison.replacementArea === 0) continue
    const [offsetX, offsetY] = comparison.centroidOffset
    for (const [axis, offset] of [
      [picture.right, offsetX],
      [picture.up, offsetY],
    ] as const) {
      for (let row = 0; row < AXIS_COUNT; row += 1) {
        for (let column = 0; column < AXIS_COUNT; column += 1) {
          normalElements[column * AXIS_COUNT + row] =
            (normalElements[column * AXIS_COUNT + row] ?? 0) +
            (axis[row] ?? 0) * (axis[column] ?? 0)
        }
      }
      projected.add(new Vector3(...axis).multiplyScalar(offset * picture.pixelSize))
    }
  }
  return normal.determinant() === 0
    ? new Vector3()
    : projected.applyMatrix3(normal.clone().invert())
}

const getVectorInLDrawUnits = (vector: Vector3): readonly number[] =>
  vector
    .clone()
    .multiplyScalar(LDRAW_UNITS_PER_STUD)
    .toArray()
    .map((value) => getRounded(value, 2))

// The numbers of one item from its views, the bounds of both drawings and the distances of its attachment points.
export const getFidelityResult = (
  item: FidelityItem,
  pictures: readonly ViewPictures[],
  originalBounds: Box3,
  replacementBounds: Box3,
  anchors: readonly FidelityAnchorResult[],
  note: string
): FidelityResult => {
  const masks = pictures.map((picture) => ({
    original: getCoverageMask(picture.originalSilhouette),
    replacement: getCoverageMask(picture.replacementSilhouette),
  }))
  const comparisons = pictures.map((picture, index) =>
    compareSilhouettes(
      masks[index]?.original ?? new Uint8Array(0),
      masks[index]?.replacement ?? new Uint8Array(0),
      picture.size
    )
  )
  const views = pictures.map((picture, index): FidelityViewResult => ({
    view: picture.view,
    intersectionOverUnion: getRounded(comparisons[index]?.intersectionOverUnion ?? 0),
    colorDifference: ((difference) => (difference === null ? null : getRounded(difference, 2)))(
      getMeanColorDifference(
        picture.originalColor,
        picture.replacementColor,
        masks[index]?.original ?? new Uint8Array(0),
        masks[index]?.replacement ?? new Uint8Array(0)
      )
    ),
  }))
  const originalSize = originalBounds.getSize(new Vector3())
  const replacementSize = replacementBounds.getSize(new Vector3())
  const sizeRatio = [0, 1, 2].map((axis) => {
    const originalExtent = originalSize.getComponent(axis)
    return originalExtent < MINIMUM_EXTENT ? 1 : replacementSize.getComponent(axis) / originalExtent
  })
  const scaleRatio = Math.cbrt(sizeRatio.reduce((product, ratio) => product * ratio, 1))
  const centroidOffset = getCentroidOffset(pictures, comparisons)
  const intersections = views.map((view) => view.intersectionOverUnion)
  const meanIntersectionOverUnion = getMean(intersections) ?? 0
  const meanColorDifference = getMean(
    views.flatMap((view) => (view.colorDifference === null ? [] : [view.colorDifference]))
  )
  const meanAnchorDistance = getMean(anchors.map((anchor) => anchor.distance))
  const score = getFidelityScore({
    meanIntersectionOverUnion,
    centroidDistance: centroidOffset.length() * LDRAW_UNITS_PER_STUD,
    scaleRatio: scaleRatio > 0 ? scaleRatio : Number.NaN,
    meanColorDifference,
    meanAnchorDistance,
  })
  return Object.freeze({
    id: item.id,
    kind: item.kind,
    name: item.name,
    score,
    isPassed: score >= FIDELITY_PASS_SCORE,
    views,
    meanIntersectionOverUnion: getRounded(meanIntersectionOverUnion),
    minimumIntersectionOverUnion: getRounded(Math.min(...intersections)),
    centroidOffset: getVectorInLDrawUnits(centroidOffset),
    boundsCentreOffset: getVectorInLDrawUnits(
      replacementBounds.getCenter(new Vector3()).sub(originalBounds.getCenter(new Vector3()))
    ),
    sizeRatio: sizeRatio.map((ratio) => getRounded(ratio)),
    scaleRatio: getRounded(scaleRatio),
    meanColorDifference: meanColorDifference === null ? null : getRounded(meanColorDifference, 2),
    anchors,
    meanAnchorDistance: meanAnchorDistance === null ? null : getRounded(meanAnchorDistance, 2),
    note,
  })
}

// An item that could not be measured: score 0, so it heads the table.
export const getUnmeasuredResult = (item: FidelityItem, note: string): FidelityResult =>
  Object.freeze({
    id: item.id,
    kind: item.kind,
    name: item.name,
    score: 0,
    isPassed: false,
    views: [],
    meanIntersectionOverUnion: 0,
    minimumIntersectionOverUnion: 0,
    centroidOffset: [0, 0, 0],
    boundsCentreOffset: [0, 0, 0],
    sizeRatio: [0, 0, 0],
    scaleRatio: 0,
    meanColorDifference: null,
    anchors: [],
    meanAnchorDistance: null,
    note,
  })

// The distance between an attachment point of the original and the replacement's, LDraw units (the points are in studs); null points
// (one side has no such point) are left out.
export const getAnchorResult = (
  name: string,
  original: Vector3 | null,
  replacement: Vector3 | null
): readonly FidelityAnchorResult[] =>
  original === null || replacement === null
    ? []
    : [{ name, distance: getRounded(original.distanceTo(replacement) * LDRAW_UNITS_PER_STUD, 2) }]
