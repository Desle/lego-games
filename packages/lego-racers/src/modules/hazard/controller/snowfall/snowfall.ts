import { setEmitterBasis, setEmitterPosition, getEmitterBasis } from '../../../emitter/index.ts'
import { getNormalizedVector3 } from '../../../simulation-math/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { SnowfallData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  getActiveAfterEndRequest,
  getIdleWithEmitterReleased,
  getWithData,
  NO_IDENTIFIER,
  releaseTrackEmitter,
  spawnTrackEmitter,
} from '../hazard-helpers/hazard-helpers.ts'

// An emitter older than this is released and made again (0x0048eb00).
const EMITTER_MAXIMUM_MILLISECONDS = 1000
const EMITTER_NAME = 'snow'
const UINT32_MODULUS = 0x1_0000_0000
// How far in front of the camera the flakes are made, and the weight of the camera's second row in the height.
const CAMERA_DISTANCE = 100 // float32 100.0 at 0x004b461c
const SECOND_ROW_HEIGHT = -40 // float32 -40.0 at 0x004b4620
// The flakes are spread over 200 units across the view: the table value modulo 200, less 100 (0x0048ec75, 0x0048ec89).
const SPREAD_UNITS = 200 // MOV ECX,0xc8 at 0x0048ec42
const SPREAD_HALF = 100 // SUB EDX,0x64 at 0x0048ec89
// The racer the hook reads is the first (race +0x2ba8 points at it, also in the demonstration).
const PLAYER_RACER_INDEX = 0
const WORLD_UP = Object.freeze({ x: 0, y: 0, z: 1 })

const getIsSnowfallData = (data: HazardInstance['data']): data is SnowfallData =>
  data.keyword === HazardKeyword.HAZARD_2F

const begin = (instance: HazardInstance): HazardInstance => {
  const { data } = instance
  if (!getIsSnowfallData(data)) return instance
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.ACTIVE,
    data: Object.freeze({ ...data, isEnabled: true }),
  })
}

// 0x0048ece0: the snow stops falling.
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsSnowfallData(data)) return instance
  return getWithData(getIdleWithEmitterReleased(instance, session, data.emitterHandle), {
    ...data,
    emitterHandle: null,
  })
}

// 0x0048e980 (constructor), 0x0048ea50 (loader, which begins at once), 0x0048eb00 (update), 0x0048eb70 (after the
// racers): a "snow" emitter that is remade every second. The camera hook places it relative to the player; it
// draws once per frame while the emitter exists, and takes the flag from the racer\'s +0x3d8 (taken as 0, the racer
// is outdoors: hypothesis, the field is not ported).
export const SNOWFALL: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition) =>
    begin(
      Object.freeze({
        definition,
        identifier: NO_IDENTIFIER,
        lifecycle: HazardLifecycle.IDLE,
        data: Object.freeze({
          keyword: HazardKeyword.HAZARD_2F,
          emitterHandle: null,
          milliseconds: 0,
          isEnabled: false,
          placementValue: 0,
        } satisfies SnowfallData),
      })
    ),
  begin,
  end,
  update: (instance, session, milliseconds) => {
    const checked = getActiveAfterEndRequest(instance, (current) => end(current, session))
    if (checked === null) return instance
    const { data } = checked
    if (!getIsSnowfallData(data)) return checked
    const elapsed = (data.milliseconds + milliseconds) % UINT32_MODULUS
    const isReleased = elapsed > EMITTER_MAXIMUM_MILLISECONDS && data.emitterHandle !== null
    if (isReleased) releaseTrackEmitter(session, data.emitterHandle)
    const held = isReleased ? null : data.emitterHandle
    if (!data.isEnabled || held !== null) {
      return getWithData(checked, { ...data, milliseconds: elapsed, emitterHandle: held })
    }
    const handle = spawnTrackEmitter(session, EMITTER_NAME)
    return getWithData(checked, {
      ...data,
      milliseconds: handle === null ? elapsed : 0,
      emitterHandle: handle,
    })
  },
  updateAfterRacers: (instance, session) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    const { data } = instance
    if (!getIsSnowfallData(data)) return instance
    // 0x0048eb70: while a track event's colour shift is on the racer (+0x3d8) it does not snow and the emitter goes.
    if (session.getRacer(PLAYER_RACER_INDEX)?.isColourShifted === true) {
      releaseTrackEmitter(session, data.emitterHandle)
      return getWithData(instance, { ...data, isEnabled: false, emitterHandle: null })
    }
    const withFlag = getWithData(instance, { ...data, isEnabled: true })
    // It draws once to place the flakes across the view (followCameras uses the value).
    if (data.emitterHandle === null) return withFlag
    return getWithData(withFlag, {
      ...data,
      isEnabled: true,
      placementValue: session.drawRandomValue(),
    })
  },
  // The rest of 0x0048eb70: the emitter faces along the camera's horizontal heading and sits 100 in front of it (and
  // 40 against its second row up), moved across the view by the drawn value.
  followCameras: (instance, session, cameras) => {
    const { data } = instance
    const camera = cameras[0]
    const pool = session.getEmitters()
    if (
      !getIsSnowfallData(data) ||
      data.emitterHandle === null ||
      camera === undefined ||
      pool === null
    ) {
      return instance
    }
    const { add, multiply, storeFloat, subtract } = session.arithmetic
    const { position, forward, second } = camera
    const across = (data.placementValue % SPREAD_UNITS) - SPREAD_HALF
    const heading = getNormalizedVector3(session.arithmetic, { x: forward.x, y: forward.y, z: 0 })
    const centre = {
      x: storeFloat(add(multiply(CAMERA_DISTANCE, forward.x), position.x)),
      y: storeFloat(add(multiply(CAMERA_DISTANCE, forward.y), position.y)),
      z: storeFloat(
        add(
          add(multiply(CAMERA_DISTANCE, forward.z), position.z),
          multiply(SECOND_ROW_HEIGHT, second.z)
        )
      ),
    }
    const placed = Object.freeze({
      x: storeFloat(add(multiply(heading.y, across), centre.x)),
      y: storeFloat(add(multiply(subtract(0, heading.x), across), centre.y)),
      z: centre.z,
    })
    const faced = setEmitterBasis(
      pool,
      data.emitterHandle,
      getEmitterBasis(session.arithmetic, heading, WORLD_UP)
    )
    session.setEmitters(setEmitterPosition(faced, data.emitterHandle, placed))
    return instance
  },
})
