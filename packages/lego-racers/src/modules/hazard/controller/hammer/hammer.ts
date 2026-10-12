import {
  getSkeletonInstanceChainAxes,
  getSkeletonInstanceChainPosition,
  getSkeletonInstanceWithTime,
} from '../../../world-animation/index.ts'
import type { CollisionBody } from '../../../racer-collision/index.ts'
import {
  getFloatFromBits,
  getRotationFromFrameAxes,
  IDENTITY_MATRIX3,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { HammerData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { getHazard3E } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getActiveAfterEndRequest,
  setSkeletonInstance,
} from '../hazard-helpers/hazard-helpers.ts'

const getIsHammerData = (data: HazardInstance['data']): data is HammerData =>
  data.keyword === HazardKeyword.HAZARD_3E

const HAMMER_MASS = getFloatFromBits(0x469c4000) // 0x004b42ec, 20,000
const HALF = 0.5 // 0x004af58c
const BODY_BONE_INDEX = 1
const AXES_NAME_PREFIX = 'rk' // 0x004c22d4

// 0x0048bbf0: the figure's sphere has half the largest dimension as its radius, each half stored, the first
// dimension to beat the running maximum (strictly) winning; the box is the file's size at scale 1 (0x00441210), with
// the inverse of the mass (0x004409f0) and no velocity, and sits where the constructors left it until the first update.
const getLoadedBody = (arithmetic: FloatArithmetic, dimensions: Vector3): CollisionBody => {
  const { multiply, divide, storeFloat, getIsBelow } = arithmetic
  const [x, y, z] = dimensions
  const radius = [y, z].reduce(
    (largest, dimension) => {
      const half = storeFloat(multiply(dimension, HALF))
      return getIsBelow(largest, half) ? half : largest
    },
    storeFloat(multiply(x, HALF))
  )
  return Object.freeze({
    sphere: Object.freeze({ centre: ZERO_VECTOR3, radius }),
    box: Object.freeze({
      rotation: IDENTITY_MATRIX3,
      centre: ZERO_VECTOR3,
      dimensions: Object.freeze({ x, y, z }),
      scale: 1,
    }),
    linearVelocity: ZERO_VECTOR3,
    inverseMass: storeFloat(divide(1, HAMMER_MASS)),
  })
}

// 0x0048be70, after the common update: the chain of bone 1 up to the root gives the point (taken through each bone's
// transform, scaled by the model's scale times the instance's and carried by the instance's frame) that is the box's
// centre of mass (+0x30) and the figure's position (0x00411cc0); for a name starting "rk" the root's rows 0 and 2
// become the figure's axes (frame slot +0x40).
const getFollowedBody = (
  arithmetic: FloatArithmetic,
  data: HammerData,
  session: Parameters<HazardBehavior['update']>[1]
): CollisionBody => {
  const current = getSkeletonInstance(session, data.instance)
  if (current === null) return data.body
  const skeleton = Object.freeze({ ...current, clip: data.posedClip })
  const position = getSkeletonInstanceChainPosition(
    arithmetic,
    skeleton,
    BODY_BONE_INDEX,
    skeleton.scale
  )
  if (position === null) return data.body
  const axes = data.isFollowingAxes
    ? getSkeletonInstanceChainAxes(arithmetic, skeleton, BODY_BONE_INDEX)
    : null
  const [x, y, z] = position
  const centre = Object.freeze({ x, y, z })
  return Object.freeze({
    ...data.body,
    sphere: Object.freeze({ centre, radius: data.body.sphere.radius }),
    box: Object.freeze({
      ...data.body.box,
      centre,
      rotation: axes === null ? data.body.box.rotation : getRotationFromFrameAxes(arithmetic, axes),
    }),
  })
}

// 0x0048bb00 (constructor), 0x0048bbf0 (loader), 0x0048be00 (Begin), 0x0048be50 (End), 0x0048be70 (update): the
// swinging hammer of Royal Knights Raceway. The loader finds the skeleton instance by name and sets its clip time to
// the file's float (0 there); while active the hammer sits in the racers' collision list (a rigid body, a box of the
// file's size) and every update moves that body to the pose of bone 1's chain. Its touch slot (0x004513d0) does
// nothing: the racers' listener (0x00438560) answers the hits.
export const HAMMER: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { name, integer, float, vector } = getHazard3E(definition)
    const reference = findSkeletonReference(context.session, 'track', name)
    const skeleton = getSkeletonInstance(context.session, reference)
    if (skeleton !== null) {
      setSkeletonInstance(context.session, reference, getSkeletonInstanceWithTime(skeleton, float))
    }
    return Object.freeze({
      definition,
      identifier: integer,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_3E,
        instance: reference,
        isFollowingAxes: name.startsWith(AXES_NAME_PREFIX),
        posedClip: skeleton?.clip ?? null,
        body: getLoadedBody(context.session.arithmetic, vector),
      } satisfies HammerData),
    })
  },
  begin: (instance) => Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE }),
  end: (instance) => getIdleHazard(instance),
  update: (instance, session) => {
    if (!getIsHammerData(instance.data)) return instance
    const { data } = instance
    const posedClip = getSkeletonInstance(session, data.instance)?.clip ?? data.posedClip
    const checked = getActiveAfterEndRequest(instance, getIdleHazard)
    const followed = checked !== null && getIsHammerData(checked.data) ? checked : null
    return Object.freeze({
      ...(followed ?? instance),
      data: Object.freeze({
        ...data,
        posedClip,
        body: followed === null ? data.body : getFollowedBody(session.arithmetic, data, session),
      }),
    })
  },
  getCollisionBody: (instance) =>
    instance.lifecycle === HazardLifecycle.ACTIVE && getIsHammerData(instance.data)
      ? instance.data.body
      : null,
})
