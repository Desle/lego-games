import { getFloatFromBits, getTruncatedInteger } from '../../../simulation-math/index.ts'
import { getTextureScrollWithRates } from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { ScrollerData } from '../../types/hazard-data.types.ts'
import { getHazard36 } from '../hazard-definition/hazard-definition.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findMeshReference,
  findSkeletonReference,
  getMeshInstance,
  getSkeletonInstance,
  getUpdatedAfterEndRequest,
  setMeshInstance,
  setSkeletonInstance,
  getWithData,
  NO_IDENTIFIER,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x004b41f8: the scroll repeats every 10,000 milliseconds.
const CYCLE_MILLISECONDS = 10_000

// The clock as a table index, counted backwards.
const CLOCK_SCALE = getFloatFromBits(0x38d1b717) // float32 0.0001 at 0x004b41f4
const FULL_TURN = getFloatFromBits(0x40c90fdb) // float32 2 pi at 0x004b02f8
const TABLE_INDEX_PER_RADIAN_BACKWARDS = getFloatFromBits(0xc322f983) // float32 -1024 / 2 pi at 0x004b02f4
const TABLE_MASK = 0x3ff // the AND at 0x0048b2a2
const TABLE_QUARTER_TURN = 0x100 // the MOV at 0x0048b29b (0xffffff00 minus the index)

const getIsScrollerData = (data: HazardInstance['data']): data is ScrollerData =>
  data.keyword === HazardKeyword.HAZARD_36

// 0x0048b110: the name is looked up in the first world's mesh instances, then its skeleton instances, then the
// second world's.
const findScrolledInstance = (session: HazardSession, name: string) =>
  findMeshReference(session, 'track', name) ??
  findSkeletonReference(session, 'track', name) ??
  findMeshReference(session, 'blended', name) ??
  findSkeletonReference(session, 'blended', name)

// 0x0048b080 (constructor), 0x0048b110 (loader), 0x0048b220 (Begin), 0x0048b240 (update): a texture scrolls with
// the time of a 10,000 ms cycle. Each update sets the instance's scroll rates (0x00411700, 0x00411730) to the two
// floats times a sine of the cycle; the instance update (0x10027f40) integrates them into the offsets.
export const SCROLLER: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { name, firstFloat, secondFloat } = getHazard36(definition)
    return Object.freeze({
      definition,
      identifier: NO_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_36,
        instance: findScrolledInstance(context.session, name),
        firstFloat,
        secondFloat,
        cycleMilliseconds: 0,
      } satisfies ScrollerData),
    })
  },
  begin: (instance) => {
    const { data } = instance
    if (!getIsScrollerData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, cycleMilliseconds: 0 }),
    })
  },
  end: (instance) => getIdleHazard(instance),
  update: (instance, session, milliseconds) => {
    const checked = getUpdatedAfterEndRequest(instance, getIdleHazard)
    const { data } = checked
    if (!getIsScrollerData(data)) return checked
    const { arithmetic } = session
    const time = arithmetic.storeFloat(arithmetic.add(milliseconds, data.cycleMilliseconds))
    const cycleMilliseconds =
      time < CYCLE_MILLISECONDS
        ? time
        : arithmetic.storeFloat(arithmetic.subtract(time, CYCLE_MILLISECONDS))
    const index =
      (-TABLE_QUARTER_TURN -
        getTruncatedInteger(
          arithmetic.multiply(
            arithmetic.multiply(arithmetic.multiply(cycleMilliseconds, CLOCK_SCALE), FULL_TURN),
            TABLE_INDEX_PER_RADIAN_BACKWARDS
          )
        )) &
      TABLE_MASK
    const sine = session.getTableCosine(index)
    const scrollU = arithmetic.storeFloat(arithmetic.multiply(data.firstFloat, sine))
    const scrollV = arithmetic.storeFloat(arithmetic.multiply(data.secondFloat, sine))
    const mesh = data.instance?.kind === 'mesh' ? getMeshInstance(session, data.instance) : null
    if (mesh !== null) {
      setMeshInstance(
        session,
        data.instance,
        Object.freeze({
          ...mesh,
          textureScroll: getTextureScrollWithRates(mesh.textureScroll, scrollU, scrollV),
        })
      )
    }
    const skeleton =
      data.instance?.kind === 'skeleton' ? getSkeletonInstance(session, data.instance) : null
    if (skeleton !== null) {
      setSkeletonInstance(
        session,
        data.instance,
        Object.freeze({
          ...skeleton,
          textureScroll: getTextureScrollWithRates(skeleton.textureScroll, scrollU, scrollV),
        })
      )
    }
    return getWithData(checked, { ...data, cycleMilliseconds })
  },
})
