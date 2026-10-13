import type { ModelScene } from '@lego-games/lego-racers/scene'
import { Box3, Triangle, Vector3 } from 'three'
import type { Matrix4, Object3D } from 'three'
import { MinifigPartKey } from '../ldraw-racer/minifig-assembly.types.ts'
import type { MinifigRig } from '../ldraw-racer/minifig-rig.types.ts'
import { findWheels } from '../ldraw-racer/wheel-analysis.ts'
import { getAnchorResult } from './fidelity-measurement.ts'
import { getMeshes, getVisibleBounds } from './fidelity-render.ts'
import type { BonePoint, BoundsPair, DriverMeasures } from './fidelity-anchors.types.ts'
import type { WheelMount } from '../reference-kit/reference-kit.types.ts'
import type { FidelityAnchorResult } from './ldraw-fidelity.types.ts'

const AXIS_COUNT = 3
// A hand is the far end of an arm that is one bone: the points of the arm this share farthest from its shoulder.
const HAND_SHARE = 0.1
const SIDES = ['left', 'right'] as const
// A wheel of the original with none of the replacement's left to pair with: far enough to fail.
const MISSING_WHEEL_DISTANCE = 1000
const HAND_KEYS = Object.freeze({
  left: MinifigPartKey.LEFT_HAND,
  right: MinifigPartKey.RIGHT_HAND,
})

const getMesh = (model: ModelScene) =>
  model.scene.meshes[model.scene.instances[0]?.levels[0]?.meshIndex ?? -1] ?? null

// Every corner of the original's skeleton mesh where the pose puts it, in the world (the model's scale applied), with its bone.
export const getPosedBonePoints = (
  model: ModelScene,
  matrices: readonly Matrix4[]
): readonly BonePoint[] => {
  const mesh = getMesh(model)
  const scale = model.meshScales[0] ?? 1
  if (mesh === null) return []
  return mesh.drawBatches.flatMap((batch) =>
    [...batch.vertexIndices].map((vertex, corner) => {
      const boneIndex = batch.transformIndices[corner] ?? 0
      const point = new Vector3(
        ...[0, 1, 2].map((axis) => mesh.positions[vertex * AXIS_COUNT + axis] ?? 0)
      )
      const matrix = matrices[boneIndex]
      if (matrix !== undefined) point.applyMatrix4(matrix)
      return { boneIndex, point: point.multiplyScalar(scale) }
    })
  )
}

// A bone and every bone under it.
const getBoneFamily = (parentIndices: readonly (number | null)[], boneIndex: number) => {
  const family = new Set([boneIndex])
  for (let isGrowing = true; isGrowing;) {
    isGrowing = false
    for (const [index, parent] of parentIndices.entries()) {
      if (parent !== null && family.has(parent) && !family.has(index)) {
        family.add(index)
        isGrowing = true
      }
    }
  }
  return family
}

const getBoundsOf = (points: readonly Vector3[]): Box3 | null =>
  points.length === 0 ? null : new Box3().setFromPoints([...points])

const getCentre = (bounds: Box3 | null): Vector3 | null =>
  bounds === null || bounds.isEmpty() ? null : bounds.getCenter(new Vector3())

const getTop = (bounds: Box3 | null): Vector3 | null => {
  const centre = getCentre(bounds)
  return centre === null || bounds === null ? null : centre.setZ(bounds.max.z)
}

const getBottom = (bounds: Box3 | null): Vector3 | null => {
  const centre = getCentre(bounds)
  return centre === null || bounds === null ? null : centre.setZ(bounds.min.z)
}

// The far end of a one-bone arm: the mean of the share of its points farthest from where the bone starts.
const getArmEnd = (points: readonly Vector3[], start: Vector3): Vector3 | null => {
  if (points.length === 0) return null
  const sorted = [...points].sort(
    (first, second) => second.distanceTo(start) - first.distanceTo(start)
  )
  const far = sorted.slice(0, Math.max(1, Math.round(sorted.length * HAND_SHARE)))
  return far.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(far.length)
}

// Where the replacement's part holders draw, in the world; the driver drawing adds one holder per part key, in the enum's order.
const getHolderBounds = (drawing: Object3D, keys: readonly MinifigPartKey[]): Box3 | null => {
  const order = Object.values(MinifigPartKey)
  const bounds = new Box3()
  for (const key of keys) {
    const holder = drawing.children[order.indexOf(key)]
    if (holder !== undefined) bounds.union(getVisibleBounds(holder))
  }
  return bounds.isEmpty() ? null : bounds
}

// The original's hand: the hand bone (a menu figure has one) or the far end of the arm.
const getOriginalHand = (
  rig: MinifigRig,
  side: (typeof SIDES)[number],
  points: readonly BonePoint[],
  parentIndices: readonly (number | null)[],
  matrices: readonly Matrix4[],
  scale: number
): Vector3 | null => {
  const handIndex = rig.wrists?.[side].handIndex
  if (handIndex !== undefined) {
    const family = getBoneFamily(parentIndices, handIndex)
    return getCentre(
      getBoundsOf(points.filter((entry) => family.has(entry.boneIndex)).map((entry) => entry.point))
    )
  }
  const arm = rig.limbs.arms[side]
  const boneIndex = arm.kind === 'bone' ? arm.boneIndex : arm.endIndex
  const boneMatrix = matrices[boneIndex]
  const start =
    boneMatrix === undefined
      ? new Vector3()
      : new Vector3().setFromMatrixPosition(boneMatrix).multiplyScalar(scale)
  const armPoints = points
    .filter((entry) => entry.boneIndex === boneIndex)
    .map((entry) => entry.point)
  return arm.kind === 'bone' ? getArmEnd(armPoints, start) : getCentre(getBoundsOf(armPoints))
}

const getPair = (original: Box3 | null, replacement: Box3 | null): BoundsPair | null =>
  original === null || replacement === null ? null : { original, replacement }

// The attachment points of a driver: the head's centre, the top of the head and hat (a hat on the head), the hands, and the seat (the
// bottom of the hips and legs), the original's from the bones of its skeleton mesh, the replacement's from its part holders; and the
// regions of the head (with the hat), the torso (with the arms) and the hips and legs on both sides.
export const getDriverMeasures = (
  model: ModelScene,
  rig: MinifigRig,
  parentIndices: readonly (number | null)[],
  matrices: readonly Matrix4[],
  drawing: Object3D
): DriverMeasures => {
  const points = getPosedBonePoints(model, matrices)
  const scale = model.meshScales[0] ?? 1
  const getFamilyPoints = (boneIndex: number, excludedIndex: number | null) => {
    const family = getBoneFamily(parentIndices, boneIndex)
    const excluded =
      excludedIndex === null || excludedIndex === boneIndex
        ? new Set<number>()
        : getBoneFamily(parentIndices, excludedIndex)
    return points
      .filter((entry) => family.has(entry.boneIndex) && !excluded.has(entry.boneIndex))
      .map((entry) => entry.point)
  }
  const head = getPair(
    getBoundsOf(getFamilyPoints(rig.headIndex, null)),
    getHolderBounds(drawing, [MinifigPartKey.HEAD])
  )
  const torso = getPair(
    getBoundsOf(getFamilyPoints(rig.torsoIndex, rig.headIndex)),
    getHolderBounds(drawing, [
      MinifigPartKey.TORSO,
      MinifigPartKey.LEFT_ARM,
      MinifigPartKey.RIGHT_ARM,
      MinifigPartKey.LEFT_HAND,
      MinifigPartKey.RIGHT_HAND,
    ])
  )
  const seat = getPair(
    getBoundsOf(getFamilyPoints(rig.pelvisIndex, rig.torsoIndex)),
    getHolderBounds(drawing, [
      MinifigPartKey.HIPS,
      MinifigPartKey.LEFT_LEG,
      MinifigPartKey.RIGHT_LEG,
    ])
  )
  return {
    anchors: [
      ...getAnchorResult(
        'head',
        getCentre(head?.original ?? null),
        getCentre(head?.replacement ?? null)
      ),
      ...getAnchorResult(
        'head top',
        getTop(head?.original ?? null),
        getTop(head?.replacement ?? null)
      ),
      ...SIDES.flatMap((side) =>
        getAnchorResult(
          `${side} hand`,
          getOriginalHand(rig, side, points, parentIndices, matrices, scale),
          getCentre(getHolderBounds(drawing, [HAND_KEYS[side]]))
        )
      ),
      ...getAnchorResult(
        'seat',
        getBottom(seat?.original ?? null),
        getBottom(seat?.replacement ?? null)
      ),
    ],
    regions: { head, torso, seat },
  }
}

// The original's wheel centres (its wheel model's pieces, on their bones in this pose), in the world.
export const getOriginalWheelCentres = (
  model: ModelScene,
  matrices: readonly Matrix4[]
): readonly Vector3[] => {
  const mesh = getMesh(model)
  const scale = model.meshScales[0] ?? 1
  if (mesh === null) return []
  return findWheels(mesh).map((wheel) => {
    const centre = new Vector3(...wheel.centre.slice(0, AXIS_COUNT))
    const matrix = matrices[wheel.boneIndex]
    if (matrix !== undefined) centre.applyMatrix4(matrix)
    return centre.multiplyScalar(scale)
  })
}

// Each original wheel centre against the nearest replacement wheel not taken yet.
export const getWheelAnchors = (
  originals: readonly Vector3[],
  replacements: readonly Vector3[]
): readonly FidelityAnchorResult[] => {
  const free = [...replacements]
  return originals.flatMap((original, index) => {
    const nearest = free
      .map((candidate, position) => ({ position, distance: candidate.distanceTo(original) }))
      .sort((first, second) => first.distance - second.distance)[0]
    const match = nearest === undefined ? null : (free.splice(nearest.position, 1)[0] ?? null)
    return match === null
      ? [{ name: `wheel ${String(index + 1)} missing`, distance: MISSING_WHEEL_DISTANCE }]
      : getAnchorResult(`wheel ${String(index + 1)}`, original, match)
  })
}

// The centres of the groups that hold one wheel each.
export const getHolderCentres = (holders: readonly Object3D[]): readonly Vector3[] =>
  holders.flatMap((holder) => {
    const centre = getCentre(getVisibleBounds(holder))
    return centre === null ? [] : [centre]
  })

const AXLE_INDICES: Readonly<Record<string, number>> = Object.freeze({ x: 0, y: 1, z: 2 })

// The distance from a point to the nearest face that a drawing draws, in the world.
const getNearestSurfaceDistance = (object: Object3D, point: Vector3): number | null => {
  object.updateMatrixWorld(true)
  const triangle = new Triangle()
  const nearest = new Vector3()
  let distance: number | null = null
  for (const mesh of getMeshes(object, true)) {
    if (!mesh.geometry.hasAttribute('position')) continue
    const positions = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = index === null ? positions.count : index.count
    const getCorner = (corner: number): number => (index === null ? corner : index.getX(corner))
    for (let corner = 0; corner + 2 < count; corner += 3) {
      triangle.a.fromBufferAttribute(positions, getCorner(corner)).applyMatrix4(mesh.matrixWorld)
      triangle.b
        .fromBufferAttribute(positions, getCorner(corner + 1))
        .applyMatrix4(mesh.matrixWorld)
      triangle.c
        .fromBufferAttribute(positions, getCorner(corner + 2))
        .applyMatrix4(mesh.matrixWorld)
      const candidate = triangle.closestPointToPoint(point, nearest).distanceTo(point)
      distance = distance === null ? candidate : Math.min(distance, candidate)
    }
  }
  return distance
}

// Each wheel the game puts on a chassis against a chassis recipe's base: the distance from the wheel's hub (the middle of its inner
// face, where an axle or a holder meets it) to the nearest face of the base. A base holds the game's wheels when it reaches every hub.
export const getWheelHubAnchors = (
  mounts: readonly WheelMount[],
  base: Object3D
): readonly FidelityAnchorResult[] =>
  mounts.flatMap((mount, wheelIndex) => {
    const axleIndex = AXLE_INDICES[mount.axle] ?? 1
    const hub = new Vector3(...mount.centre)
    const outward = Math.sign(hub.getComponent(axleIndex))
    hub.setComponent(axleIndex, hub.getComponent(axleIndex) - (outward * mount.width) / 2)
    const distance = getNearestSurfaceDistance(base, hub)
    return getAnchorResult(
      `wheel ${String(wheelIndex + 1)} hub`,
      hub,
      distance === null ? null : hub.clone().setX(hub.x + distance)
    )
  })
