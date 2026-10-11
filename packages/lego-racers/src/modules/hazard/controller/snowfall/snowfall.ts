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
    const withFlag = getWithData(instance, { ...data, isEnabled: true })
    // 0x0048eb70 draws once to place the flakes (a value below 200, centred on the camera).
    if (data.emitterHandle !== null) session.drawRandomValue()
    return withFlag
  },
})
