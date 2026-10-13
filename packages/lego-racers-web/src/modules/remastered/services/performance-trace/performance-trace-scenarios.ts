import type { PowerUpUse } from '../hd-coverage/hd-coverage.types.ts'
import type {
  PerformanceScenario,
  PerformanceViewport,
  RaceScenarioSubject,
} from './performance-trace.types.ts'

// The main menu has opened by step 96 (the pixel trace's keys start there); 60 more steps let its figure settle.
const MAIN_MENU_SETTLE_STEPS = 156
const CAR_BUILDER_SCREEN_ID = 0x0e
const FULL_GRID_RACER_COUNT = 6
// The countdown runs until frame 160, when the racers are released.
const RACE_START_FRAME = 120
// The sliding player's dust and tire smoke are behind it, in front of the camera (the HD coverage's on-screen slide frame).
const POWER_SLIDE_FRAME = 200
const FIRST_POWER_UP_FRAME = 170
const POWER_UP_SPACING_FRAMES = 8
const POWER_UP_SHOWN_DELAY_FRAMES = 10
// Kind and level of each power-up the player is handed and fires in a burst: a rocket, a barrel, a magnet, a shield, a warp, a cannon.
const BURST_POWER_UPS: readonly (readonly [number, number])[] = [
  [1, 3],
  [4, 1],
  [4, 2],
  [2, 3],
  [3, 3],
  [1, 0],
]
const BUILDER_CAR_ITEM_ID = 'RRCM'

export const MEASURED_FRAME_COUNT = 60

export const PERFORMANCE_VIEWPORTS: readonly PerformanceViewport[] = [
  { name: 'desktop', width: 1280, height: 720, devicePixelRatio: 1, isTouchScreen: false },
  { name: 'ipad', width: 1180, height: 820, devicePixelRatio: 2, isTouchScreen: true },
  { name: 'phone', width: 390, height: 844, devicePixelRatio: 3, isTouchScreen: true },
]

const BURST_USES: readonly PowerUpUse[] = BURST_POWER_UPS.map(([kind, level], index) => ({
  frame: FIRST_POWER_UP_FRAME + POWER_UP_SPACING_FRAMES * index,
  kind,
  level,
}))

const getRaceSubject = (
  measuredFrame: number,
  isPlayerSliding: boolean,
  powerUpUses: readonly PowerUpUse[]
): RaceScenarioSubject => ({
  kind: 'race',
  racerCount: FULL_GRID_RACER_COUNT,
  isPlayerSliding,
  powerUpUses,
  measuredFrame,
})

const getLastUseFrame = (uses: readonly PowerUpUse[]): number =>
  Math.max(...uses.map((use) => use.frame))

export const PERFORMANCE_SCENARIOS: readonly PerformanceScenario[] = [
  {
    name: 'main-menu-classic',
    isRemastered: false,
    subject: { kind: 'menu', firstScreenId: null, settleSteps: MAIN_MENU_SETTLE_STEPS },
  },
  {
    name: 'main-menu-hd',
    isRemastered: true,
    subject: { kind: 'menu', firstScreenId: null, settleSteps: MAIN_MENU_SETTLE_STEPS },
  },
  {
    name: 'race-start-classic',
    isRemastered: false,
    subject: getRaceSubject(RACE_START_FRAME, false, []),
  },
  {
    name: 'race-start-hd',
    isRemastered: true,
    subject: getRaceSubject(RACE_START_FRAME, false, []),
  },
  {
    name: 'power-slide-hd',
    isRemastered: true,
    subject: getRaceSubject(POWER_SLIDE_FRAME, true, []),
  },
  {
    name: 'power-up-burst-hd',
    isRemastered: true,
    subject: getRaceSubject(
      getLastUseFrame(BURST_USES) + POWER_UP_SHOWN_DELAY_FRAMES,
      false,
      BURST_USES
    ),
  },
  {
    name: 'garage-car-builder-hd',
    isRemastered: true,
    subject: { kind: 'menu', firstScreenId: CAR_BUILDER_SCREEN_ID, settleSteps: 60 },
  },
  {
    name: 'ldraw-builder-car',
    isRemastered: true,
    subject: { kind: 'builder', itemId: BUILDER_CAR_ITEM_ID },
  },
]
