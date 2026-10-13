import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { LavaData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import type { LavaVent } from './lava.types.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getIsRacerSpinnable,
  getSkeletonInstance,
  getSphereOnBone,
  getSphereWhileRegistered,
  getUpdatedAfterEndRequest,
  getWithData,
  spawnTrackEmitter,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048d8e0: the identifier 0.
export const LAVA_IDENTIFIER = 0
const INSTANCE_NAME = 'mmlavbl'
const ROOT_BONE_INDEX = 0
const ORIGIN = Object.freeze([0, 0, 0] as const)
// 0x004b44b0
const SMOKE_EMITTER_NAME = 'lavasmk'
// 0x0048db33 and 0x0048dbd2: the waits after a spill and after a signal.
const SMOKE_WAIT_MILLISECONDS = 800 // 0x320 at 0x0048db33
const SIGNAL_WAIT_MILLISECONDS = 400 // 0x190 at 0x0048db6a
// The signal the lava announces at a vent as it sinks or rises (0x00462580 with 0x2b, 0x2b).
export const LAVA_SIGNAL = 0x2b
// 0x0048dc50: the sound the lava holds after it rose at a vent (RaceSounds_Get with 0xbba).
const RISEN_SOUND = 0xbba
// 0x004afde0: a signal is announced within 10 frames after the clip passes a vent's time.
const SIGNAL_WINDOW_FRAMES = 10

// 0x004c22d8, 0x004b44c8 and 0x004b44d4: the three vents of the magma track; the lava sinks at `sinkFrame` and rises
// at `riseFrame` of its clip, and smoke spills at the vent in between.
const VENTS: readonly LavaVent[] = Object.freeze([
  Object.freeze({
    position: Object.freeze([
      // 0x004c22d8
      getFloatFromBits(0x44104000),
      // 0x004c22dc
      getFloatFromBits(0xc3de0000),
      // 0x004c22e0
      getFloatFromBits(0x40eab021),
    ] as const),
    // 0x004b44c8
    sinkFrame: getFloatFromBits(0x00000000),
    // 0x004b44d4
    riseFrame: getFloatFromBits(0x41d00000),
  }),
  Object.freeze({
    position: Object.freeze([
      // 0x004c22e4
      getFloatFromBits(0x44174000),
      // 0x004c22e8
      getFloatFromBits(0xc3fa0000),
      // 0x004c22ec
      getFloatFromBits(0x41980000),
    ] as const),
    // 0x004b44cc
    sinkFrame: getFloatFromBits(0x42740000),
    // 0x004b44d8
    riseFrame: getFloatFromBits(0x42ac0000),
  }),
  Object.freeze({
    position: Object.freeze([
      // 0x004c22f0
      getFloatFromBits(0x44034000),
      // 0x004c22f4
      getFloatFromBits(0xc3fc8000),
      // 0x004c22f8
      getFloatFromBits(0x40933333),
    ] as const),
    // 0x004b44d0
    sinkFrame: getFloatFromBits(0x42ee0000),
    // 0x004b44dc
    riseFrame: getFloatFromBits(0x43120000),
  }),
])

const getIsLavaData = (data: HazardInstance['data']): data is LavaData =>
  data.keyword === HazardKeyword.HAZARD_2C

// 0x00443c10 on the sound +0x48.
const releaseRisenSound = (session: HazardSession): void =>
  session.emit({ type: 'hazard.looped_sound_stopped', keyword: HazardKeyword.HAZARD_2C })

const getVentPosition = (data: LavaData, position: Vector3): Vector3 =>
  data.isMirrored ? Object.freeze([position[0], -position[1], position[2]] as const) : position

const getCountedDown = (remaining: number, milliseconds: number): number =>
  milliseconds > remaining ? 0 : remaining - milliseconds

// 0x0048dac8..0x0048db58: once the wait is over, every vent whose window holds the clip time spills smoke at itself.
const getAfterSmoke = (
  session: HazardSession,
  data: LavaData,
  time: number,
  milliseconds: number
): LavaData => {
  if (data.smokeMilliseconds !== 0) {
    return { ...data, smokeMilliseconds: getCountedDown(data.smokeMilliseconds, milliseconds) }
  }
  return VENTS.reduce((current, vent) => {
    if (!(vent.sinkFrame < time && time < vent.riseFrame)) return current
    spawnTrackEmitter(session, SMOKE_EMITTER_NAME, getVentPosition(current, vent.position))
    return { ...current, smokeMilliseconds: SMOKE_WAIT_MILLISECONDS }
  }, data)
}

const getIsJustPast = (time: number, frame: number): boolean =>
  frame < time && time < frame + SIGNAL_WINDOW_FRAMES

// 0x0048db58..0x0048dcbd: once the wait is over, a vent the clip just sank at announces signal 0x2b and lets the sound
// go; a vent it just rose at announces it and takes the sound 0xbba (played with 1, heard from 200 to 300 units).
const getAfterSignals = (
  session: HazardSession,
  data: LavaData,
  time: number,
  milliseconds: number
): LavaData => {
  if (data.signalMilliseconds !== 0) {
    return { ...data, signalMilliseconds: getCountedDown(data.signalMilliseconds, milliseconds) }
  }
  return VENTS.reduce((current, vent) => {
    const position = getVentPosition(current, vent.position)
    let next = current
    if (getIsJustPast(time, vent.sinkFrame)) {
      session.startStopSignal(LAVA_SIGNAL, LAVA_SIGNAL, position)
      if (next.isSoundHeld) releaseRisenSound(session)
      next = { ...next, signalMilliseconds: SIGNAL_WAIT_MILLISECONDS, isSoundHeld: false }
    }
    if (getIsJustPast(time, vent.riseFrame)) {
      session.startStopSignal(LAVA_SIGNAL, LAVA_SIGNAL, position)
      session.emit({
        type: 'hazard.looped_sound_started',
        keyword: HazardKeyword.HAZARD_2C,
        soundIdentifier: RISEN_SOUND,
      })
      next = { ...next, signalMilliseconds: SIGNAL_WAIT_MILLISECONDS, isSoundHeld: true }
    }
    return next
  }, data)
}

// 0x0048d9d0
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsLavaData(data)) return instance
  if (data.isSoundHeld) releaseRisenSound(session)
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.IDLE,
    data: Object.freeze({ ...data, isSoundHeld: false }),
  })
}

// 0x0048d7f0 (constructor), 0x0048d8e0 (loader), 0x0048d980 (Begin), 0x0048d9d0 (End), 0x0048da10 (update) and
// 0x0048dcd0 (touch): the lava monster of the magma track. Begin registers its sphere (the model's radius, centred on
// the first bone of "mmlavbl" every update); a racer that touches it spins. Its update also decides from the clip time
// when to spill smoke ("lavasmk", a track emitter at a vent) and announce signal 0x2b. Taken as given: that the sound
// system has a free slot for the sound 0xbba (hypothesis).
export const LAVA: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const reference = findSkeletonReference(context.session, 'track', INSTANCE_NAME)
    return Object.freeze({
      definition,
      identifier: LAVA_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_2C,
        isSoundHeld: false,
        smokeMilliseconds: 0,
        signalMilliseconds: 0,
        isMirrored: context.isMirrored,
        instance: reference,
        sphere: Object.freeze({
          centre: ORIGIN,
          radius: getSkeletonInstance(context.session, reference)?.boundsRadius ?? 0,
        }),
      } satisfies LavaData),
    })
  },
  begin: (instance) => {
    const { data } = instance
    if (!getIsLavaData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, smokeMilliseconds: 0, signalMilliseconds: 0 }),
    })
  },
  end,
  touch: (instance, session, racer) => {
    if (getIsRacerSpinnable(racer)) {
      session.emit({
        type: 'hazard.racer_affected',
        keyword: HazardKeyword.HAZARD_2C,
        racerIndex: racer.index,
        reaction: 'spun',
        vector: null,
      })
    }
    return instance
  },
  getRegisteredSphere: (instance) =>
    getIsLavaData(instance.data) ? getSphereWhileRegistered(instance, instance.data.sphere) : null,
  update: (instance, session, milliseconds) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    const checked = getUpdatedAfterEndRequest(instance, (current) => end(current, session))
    const { data } = checked
    if (!getIsLavaData(data)) return checked
    // 0x0048da2c: the clip time (instance +0xb4) is read before the common update.
    const time = getSkeletonInstance(session, data.instance)?.clip?.clip.timeInFrames ?? 0
    const placed: LavaData = {
      ...data,
      sphere: getSphereOnBone(session, data.instance, ROOT_BONE_INDEX, data.sphere),
    }
    return getWithData(
      checked,
      getAfterSignals(
        session,
        getAfterSmoke(session, placed, time, milliseconds),
        time,
        milliseconds
      )
    )
  },
})
