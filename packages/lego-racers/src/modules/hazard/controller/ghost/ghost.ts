import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { GhostData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getIsRacerSpinnable,
  getSkeletonInstance,
  getSphereOnBone,
  getSphereWhileRegistered,
  getUpdatedAfterEndRequest,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'

// 0x0048c960: the identifier 10.
export const GHOST_IDENTIFIER = 10
// The sound the ghost loops while it is active (0x0048cac0) and the one it makes at a racer (0x0048cbb0).
const LOOPED_SOUND = 0xbc4
// Racer flag 0x1 (+0xd04): shielded.
const SHIELDED_FLAG = 1
// 0x0048cac0: the pitch changes every 500 ms.
const PITCH_PERIOD_MILLISECONDS = 500
const PITCH_DRAW_RANGE = 100
// 0x004af668 (0.01) and 0x004b43d4 (0.4) scale the draw into the pitch offset.
const PITCH_SCALES = Object.freeze([
  getFloatFromBits(0x3c23d70a),
  getFloatFromBits(0x3ecccccd),
] as const)
const UINT32_MODULUS = 0x1_0000_0000
const INSTANCE_NAME = 'ghostly'
// 0x0048cbb0 reads the second bone of the skeleton.
const TRACKED_BONE_INDEX = 1
// 0x004b43cc: the sphere is the model's radius and 8 more.
const RADIUS_MARGIN = 8
const ORIGIN = Object.freeze([0, 0, 0] as const)
// 0x004b43d0: the vertical speed of a flung racer (0x0048ce90 adds (0, 0, 150) to the cleared velocity).
const FLING_IMPULSE = Object.freeze([0, 0, 150] as const)

const getIsGhostData = (data: HazardInstance['data']): data is GhostData =>
  data.keyword === HazardKeyword.HAZARD_2B

// 0x0048cb60: the sound stops, the ghost is idle.
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsGhostData(data)) return instance
  if (data.isSoundHeld) {
    session.emit({ type: 'hazard.looped_sound_stopped', keyword: HazardKeyword.HAZARD_2B })
  }
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.IDLE,
    data: Object.freeze({ ...data, isSoundHeld: false }),
  })
}

// 0x0048c850 (constructor), 0x0048c960 (loader), 0x0048cac0 (Begin), 0x0048cb60 (End), 0x0048cbb0 (update) and
// 0x0048ce90 (touch): the ghost of the forest track. It loops a sound while it is active, draws every 500 ms to bend
// the sound\'s pitch, and a racer that touches it without a shield is flung. Taken as given: that the sound system
// has a free slot (hypothesis). Begin registers its sphere (the model's radius and 8, centred on the second bone of
// "ghostly" every update). Not ported: the trail (emitter "ghsttrl", the pose at past times), the sound when a racer is
// near.
export const GHOST: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const reference = findSkeletonReference(context.session, 'track', INSTANCE_NAME)
    const { add, storeFloat } = context.session.arithmetic
    const modelRadius = getSkeletonInstance(context.session, reference)?.boundsRadius ?? 0
    return Object.freeze({
      definition,
      identifier: GHOST_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_2B,
        elapsedMilliseconds: 0,
        soundMilliseconds: 0,
        isSoundHeld: false,
        pitchOffset: 0,
        instance: reference,
        sphere: Object.freeze({
          centre: ORIGIN,
          radius: storeFloat(add(modelRadius, RADIUS_MARGIN)),
        }),
      } satisfies GhostData),
    })
  },
  begin: (instance, session) => {
    const { data } = instance
    if (!getIsGhostData(data)) return instance
    session.emit({
      type: 'hazard.looped_sound_started',
      keyword: HazardKeyword.HAZARD_2B,
      soundIdentifier: LOOPED_SOUND,
    })
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({
        ...data,
        soundMilliseconds: PITCH_PERIOD_MILLISECONDS,
        isSoundHeld: true,
      }),
    })
  },
  end,
  touch: (instance, session, racer) => {
    if (!getIsRacerSpinnable(racer) || (racer.flags & SHIELDED_FLAG) !== 0) return instance
    session.emit({
      type: 'hazard.racer_affected',
      keyword: HazardKeyword.HAZARD_2B,
      racerIndex: racer.index,
      reaction: 'flung',
      vector: FLING_IMPULSE,
    })
    return instance
  },
  getRegisteredSphere: (instance) =>
    getIsGhostData(instance.data) ? getSphereWhileRegistered(instance, instance.data.sphere) : null,
  update: (instance, session, milliseconds) => {
    const { data } = instance
    if (!getIsGhostData(data)) return instance
    const withTime = getWithData(instance, {
      ...data,
      elapsedMilliseconds: (data.elapsedMilliseconds + milliseconds) % UINT32_MODULUS,
    })
    if (instance.lifecycle === HazardLifecycle.IDLE) return withTime
    const ended = getUpdatedAfterEndRequest(withTime, (current) => end(current, session))
    const endedData = ended.data
    if (!getIsGhostData(endedData)) return ended
    const checked = getWithData(ended, {
      ...endedData,
      sphere: getSphereOnBone(session, endedData.instance, TRACKED_BONE_INDEX, endedData.sphere),
    })
    const checkedData = checked.data
    if (!getIsGhostData(checkedData) || !checkedData.isSoundHeld) return checked
    const soundMilliseconds = (checkedData.soundMilliseconds + milliseconds) % UINT32_MODULUS
    if (soundMilliseconds < PITCH_PERIOD_MILLISECONDS) {
      return getWithData(checked, { ...checkedData, soundMilliseconds })
    }
    const { multiply, storeFloat } = session.arithmetic
    const pitchOffset = storeFloat(
      multiply(
        multiply(session.drawRandomValue() % PITCH_DRAW_RANGE, PITCH_SCALES[0]),
        PITCH_SCALES[1]
      )
    )
    return getWithData(checked, { ...checkedData, soundMilliseconds: 0, pitchOffset })
  },
})
