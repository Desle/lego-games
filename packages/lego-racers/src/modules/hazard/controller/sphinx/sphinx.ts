import {
  findMaterialAnimationIndex,
  getRewoundMaterialPlayback,
  getStartedMaterialPlayback,
  getStoppedMaterialPlayback,
} from '../../../world-animation/index.ts'
import type { SkeletonInstanceRuntime } from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { SphinxData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  changeMaterialPlayback,
  findSkeletonReference,
  getMaterialPlayback,
  getSkeletonInstance,
  getUpdatedAfterEndRequest,
  setSkeletonInstance,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048c0c0: the identifier the sphinx's events announce.
export const SPHINX_IDENTIFIER = 12
// The signal the explosion holds while its material animation plays (0x0048c180, 0x0048c2e0).
export const SPHINX_EXPLOSION_SIGNAL = 0x10
// The distance 0x004b4338 that marks the explosion mesh as spent (a squared distance can never be negative).
const SPENT_DISTANCE = -1
const EXPLOSION_NAME = 'blowup'
const COLLISION_OBJECT_NAME = 'sphinx'
// The explosion's material animation holds the looping idle entries 0 and 1 and their one-shot copies 2 and 3.
const IDLE_ENTRIES = Object.freeze([0, 1] as const)
const ONE_SHOT_ENTRIES = Object.freeze([2, 3] as const)
const WORLD_KEY = 'blended'

const getIsSphinxData = (data: HazardInstance['data']): data is SphinxData =>
  data.keyword === HazardKeyword.HAZARD_29

const getSpentExplosion = (explosion: SkeletonInstanceRuntime): SkeletonInstanceRuntime =>
  Object.freeze({
    ...explosion,
    levelSquaredDistances: Object.freeze(explosion.levelSquaredDistances.map(() => SPENT_DISTANCE)),
  })

const getIsExplosionPlaying = (session: HazardSession, data: SphinxData): boolean =>
  data.materialAnimationIndex !== null &&
  getMaterialPlayback(session, WORLD_KEY, data.materialAnimationIndex, ONE_SHOT_ENTRIES[0])
    ?.isPlaying === true

// 0x0048c2a0: once the one-shot entry has finished (or never started) the explosion mesh is spent and the hazard
// idle.
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsSphinxData(data)) return instance
  if (getIsExplosionPlaying(session, data)) return instance
  const explosion = getSkeletonInstance(session, data.explosion)
  if (explosion !== null) {
    setSkeletonInstance(session, data.explosion, getSpentExplosion(explosion))
  }
  return Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE })
}

// 0x0048c180: unless the explosion is spent, the idle entries of the material animation "blowup" stop and their
// one-shot copies start from the beginning, the events hear signal 0x10 at the explosion's position, and the sphinx's
// collision object disappears.
const begin = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsSphinxData(data)) return instance
  const explosion = getSkeletonInstance(session, data.explosion)
  if (explosion === null || explosion.levelSquaredDistances[0] === SPENT_DISTANCE) return instance
  const animationIndex = findMaterialAnimationIndex(session.getWorld(WORLD_KEY), EXPLOSION_NAME)
  const index = animationIndex < 0 ? null : animationIndex
  if (index !== null) {
    IDLE_ENTRIES.forEach((entry) =>
      changeMaterialPlayback(session, WORLD_KEY, index, entry, getStoppedMaterialPlayback)
    )
    ONE_SHOT_ENTRIES.forEach((entry) =>
      changeMaterialPlayback(session, WORLD_KEY, index, entry, (playback) =>
        getRewoundMaterialPlayback(getStartedMaterialPlayback(playback, false))
      )
    )

    session.startSignal(SPHINX_EXPLOSION_SIGNAL, explosion.position)
  }
  session.emit({
    type: 'hazard.collision_object_changed',
    name: data.collisionObjectName,
    isSolid: false,
  })
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.ACTIVE,
    data: Object.freeze({ ...data, materialAnimationIndex: index }),
  })
}

// 0x0048c2e0: without a material animation the sphinx ends at once; with one, when the one-shot entry stops the
// explosion's signal stops and the sphinx ends.
const update = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  if (instance.lifecycle === HazardLifecycle.IDLE) return instance
  const checked = getUpdatedAfterEndRequest(instance, (current) => end(current, session))
  const { data } = checked
  if (!getIsSphinxData(data)) return checked
  if (data.materialAnimationIndex === null) return end(checked, session)
  if (getIsExplosionPlaying(session, data)) return checked
  const explosion = getSkeletonInstance(session, data.explosion)
  if (explosion !== null) {

    session.stopSignal(SPHINX_EXPLOSION_SIGNAL, explosion.position)
  }
  return end(checked, session)
}

export const SPHINX: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) =>
    Object.freeze({
      definition,
      identifier: SPHINX_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_29,
        explosion: findSkeletonReference(context.session, WORLD_KEY, EXPLOSION_NAME),
        materialAnimationIndex: null,
        collisionObjectName: COLLISION_OBJECT_NAME,
      } satisfies SphinxData),
    }),
  begin,
  end,
  update,
})

