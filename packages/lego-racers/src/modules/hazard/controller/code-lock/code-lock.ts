import {
  getAdvancedMaterialPlayback,
  getMaterialPlaybackAtLastFrame,
  getRewoundMaterialPlayback,
  getStartedMaterialPlayback,
  getStoppedMaterialPlayback,
  getWorldWithMaterialRate,
} from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { CodeLockData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import { changeMaterialPlayback, NO_IDENTIFIER } from '../hazard-helpers/hazard-helpers.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'

const WORLD_KEY = 'track'
// 0x0048d300: the lock\'s three buttons are entries 5, 4 and 3 of the track world\'s first material animation, run
// at these rates (0x3b449ba6, 0x3b83126f, 0x3ba3d70a).
const BUTTON_ENTRIES = Object.freeze([5, 4, 3] as const)
const BUTTON_RATES = Object.freeze([
  getFloatFromBits(0x3b449ba6),
  getFloatFromBits(0x3b83126f),
  getFloatFromBits(0x3ba3d70a),
] as const)
// 0x0048d730: the three code signals are 200/201, 202/203 and 204/205 in a drawn order.
const FIRST_PAIR = Object.freeze([0xc9, 200] as const)
const SECOND_PAIR = Object.freeze([0xcb, 0xca] as const)
const THIRD_PAIR = Object.freeze([0xcd, 0xcc] as const)
// 0x0048d480: the signals the lock announces.
const WRONG_BUTTON_SIGNAL = 0x14
const RIGHT_BUTTON_SIGNAL = 0x1d
const EVEN_SIGNAL = 0x15
const ODD_SIGNAL = 0x1e
const SOLVED_SIGNAL = 0x12
const OPEN_SIGNAL = 0x1c
// 0x0048d450 and 0x0048d480: the lock stays open for 2,500 ms.
const OPEN_MILLISECONDS = 0x9c4
const BEGUN_OPEN_MILLISECONDS = 1
// The other signals the buttons send: 0xcf, 0xd0, 0xd1 name buttons 0, 1, 2.
const BUTTON_SIGNALS = Object.freeze([0xcf, 0xd0, 0xd1] as const)

const getIsCodeLockData = (data: HazardInstance['data']): data is CodeLockData =>
  data.keyword === HazardKeyword.HAZARD_2D

// 0x0048d730: each pair\'s order comes from the low bit of a draw; the first of the pair is the code, the second the
// decoy.
const drawCodes = (session: HazardSession): Pick<CodeLockData, 'code' | 'decoys'> => {
  const code: number[] = []
  const decoys: number[] = []
  const pairs = [FIRST_PAIR, SECOND_PAIR, THIRD_PAIR]
  for (const pair of pairs) {
    const isSwapped = (session.drawRandomValue() & 1) !== 0
    code.push(isSwapped ? pair[1] : pair[0])
    decoys.push(isSwapped ? pair[0] : pair[1])
  }
  return { code: Object.freeze(code), decoys: Object.freeze(decoys) }
}

const begin = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsCodeLockData(data)) return instance
  const drawn = drawCodes(session)
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.ACTIVE,
    data: Object.freeze({
      ...data,
      ...drawn,
      progress: 0,
      openMilliseconds: BEGUN_OPEN_MILLISECONDS,
    }),
  })
}

// The signal a button announces when it is pressed: the code\'s own signal ends the lock\'s wrong-answer chain.
const getButtonSignal = (data: CodeLockData, identifier: number): number => {
  const buttonIndex = BUTTON_SIGNALS.indexOf(identifier as (typeof BUTTON_SIGNALS)[number])
  const expected = [FIRST_PAIR[1], SECOND_PAIR[1], THIRD_PAIR[1]][buttonIndex]
  return data.code[buttonIndex] !== expected ? WRONG_BUTTON_SIGNAL : RIGHT_BUTTON_SIGNAL
}

// 0x0048d480: a button is pressed. A decoy resets the progress, the first code button starts it, the second moves it
// on if it is next, and the third opens the lock when the first two came before it.
const onSignalStarted = (
  instance: HazardInstance,
  session: HazardSession,
  identifier: number,
  parameter: Vector3 | null
): HazardInstance => {
  const { data } = instance
  if (!getIsCodeLockData(data)) return instance
  const [first, second, third] = data.code
  let current: CodeLockData = data
  let isSolved = false
  if (data.decoys.includes(identifier)) {
    current = { ...data, progress: 0 }
  } else if (identifier === first) {
    current = { ...data, progress: 1 }
  } else if (identifier === second) {
    if (data.progress === 1) current = { ...data, progress: 3 }
  } else if (identifier === third && data.progress === 3) {
    isSolved = true
  }
  if (isSolved) {
    session.startStopSignal(SOLVED_SIGNAL, SOLVED_SIGNAL, null)
    BUTTON_ENTRIES.forEach((entry) =>
      changeMaterialPlayback(session, WORLD_KEY, data.materialAnimationIndex, entry, (playback) =>
        getStartedMaterialPlayback(playback, true)
      )
    )
    const drawn = drawCodes(session)
    current = { ...data, ...drawn, progress: 0, openMilliseconds: OPEN_MILLISECONDS }
    session.startSignal(OPEN_SIGNAL, null)
  }
  if (identifier === 200 || identifier === 0xca || identifier === 0xcc) {
    session.startStopSignal(EVEN_SIGNAL, EVEN_SIGNAL, parameter)
  } else if (identifier === 0xc9 || identifier === 0xcb || identifier === 0xcd) {
    session.startStopSignal(ODD_SIGNAL, ODD_SIGNAL, parameter)
  } else if (BUTTON_SIGNALS.includes(identifier as (typeof BUTTON_SIGNALS)[number])) {
    const signal = getButtonSignal(current, identifier)
    session.startStopSignal(signal, signal, parameter)
  }
  return Object.freeze({ ...instance, data: Object.freeze(current) })
}

// 0x0048d660: when the open time runs out the open signal stops and each button\'s material animation goes to its
// resting frame (the first when the button is part of the code, the last otherwise) and stops.
const update = (
  instance: HazardInstance,
  session: HazardSession,
  milliseconds: number
): HazardInstance => {
  const { data } = instance
  if (!getIsCodeLockData(data) || data.openMilliseconds === 0) return instance
  if (data.openMilliseconds > milliseconds) {
    return Object.freeze({
      ...instance,
      data: Object.freeze({ ...data, openMilliseconds: data.openMilliseconds - milliseconds }),
    })
  }
  session.stopSignal(OPEN_SIGNAL, null)
  const restingCodes = [FIRST_PAIR[1], SECOND_PAIR[1], THIRD_PAIR[1]]
  BUTTON_ENTRIES.forEach((entry, buttonIndex) => {
    const isResting = data.code[buttonIndex] === restingCodes[buttonIndex]
    changeMaterialPlayback(session, WORLD_KEY, data.materialAnimationIndex, entry, (playback) => {
      const placed = isResting
        ? getRewoundMaterialPlayback(playback)
        : getMaterialPlaybackAtLastFrame(
            session.getWorld(WORLD_KEY).materialAnimations[data.materialAnimationIndex]
              ?.definition ?? { materials: [], entries: [], readByteCount: 0 },
            entry,
            playback
          )
      const definition = session.getWorld(WORLD_KEY).materialAnimations[data.materialAnimationIndex]?.definition
      return getStoppedMaterialPlayback(
        definition === undefined ? placed : getAdvancedMaterialPlayback(definition, entry, placed, 0)
      )
    })
  })
  return Object.freeze({ ...instance, data: Object.freeze({ ...data, openMilliseconds: 0 }) })
}

// 0x0048d240 (constructor), 0x0048d300 (loader, which begins at once and draws three times), 0x0048d450 (Begin),
// 0x0048d480 (signal), 0x0048d660 (update).
export const CODE_LOCK: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { session } = context
    BUTTON_ENTRIES.forEach((entry, buttonIndex) => {
      const rate = BUTTON_RATES[buttonIndex]
      if (rate !== undefined) {
        session.setWorld(
          WORLD_KEY,
          getWorldWithMaterialRate(session.getWorld(WORLD_KEY), 0, entry, rate)
        )
      }
    })
    return begin(
      Object.freeze({
        definition,
        identifier: NO_IDENTIFIER,
        lifecycle: HazardLifecycle.IDLE,
        data: Object.freeze({
          keyword: HazardKeyword.HAZARD_2D,
          code: Object.freeze([]),
          decoys: Object.freeze([]),
          progress: 0,
          openMilliseconds: 0,
          materialAnimationIndex: 0,
        } satisfies CodeLockData),
      }),
      session
    )
  },
  begin,
  end: (instance) => getIdleHazard(instance),
  update,
  onSignalStarted,
})
