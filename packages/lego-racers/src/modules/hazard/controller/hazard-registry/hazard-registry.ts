import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import { CANNON, CANNON_BATTERY } from '../cannon/cannon.ts'
import { CAPTURE } from '../capture/capture.ts'
import { CODE_LOCK } from '../code-lock/code-lock.ts'
import { CRANE } from '../crane/crane.ts'
import { GATE } from '../gate/gate.ts'
import { GHOST } from '../ghost/ghost.ts'
import { HAMMER } from '../hammer/hammer.ts'
import { HAMMER_WATCHER } from '../hammer-watcher/hammer-watcher.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import { HAZARD_DROPPER } from '../hazard-dropper/hazard-dropper.ts'
import { NO_IDENTIFIER } from '../hazard-helpers/hazard-helpers.ts'
import { LAVA } from '../lava/lava.ts'
import { PERIODIC_LAUNCHER } from '../periodic-launcher/periodic-launcher.ts'
import { PILLAR } from '../pillar/pillar.ts'
import { ROCK } from '../rock/rock.ts'
import { SCROLLER } from '../scroller/scroller.ts'
import { SMOKE_VENT } from '../smoke-vent/smoke-vent.ts'
import { SNOWFALL } from '../snowfall/snowfall.ts'
import { SPHINX } from '../sphinx/sphinx.ts'
import { TURRET } from '../turret/turret.ts'
import { WARP_PAD } from '../warp-pad/warp-pad.ts'

// A keyword the original has no class for: the loader would call through a null object, so the parser refuses it;
// this stands in for the unreachable case.
const UNKNOWN: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition) =>
    Object.freeze({
      definition,
      identifier: NO_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({ keyword: 0 } as const),
    }),
  begin: (instance) => instance,
  end: (instance) => getIdleHazard(instance),
  update: (instance) => instance,
})

// The twenty classes by keyword (Hazards_Load 0x0048a4d0).
const BEHAVIORS: ReadonlyMap<number, HazardBehavior> = new Map([
  [HazardKeyword.HAZARD_28, PILLAR],
  [HazardKeyword.HAZARD_29, SPHINX],
  [HazardKeyword.HAZARD_2A, HAMMER_WATCHER],
  [HazardKeyword.HAZARD_2B, GHOST],
  [HazardKeyword.HAZARD_2C, LAVA],
  [HazardKeyword.HAZARD_2D, CODE_LOCK],
  [HazardKeyword.HAZARD_2E, ROCK],
  [HazardKeyword.HAZARD_2F, SNOWFALL],
  [HazardKeyword.HAZARD_30, SMOKE_VENT],
  [HazardKeyword.HAZARD_32, CRANE],
  [HazardKeyword.HAZARD_33, CANNON],
  [HazardKeyword.HAZARD_34, GATE],
  [HazardKeyword.HAZARD_36, SCROLLER],
  [HazardKeyword.HAZARD_3D, CANNON_BATTERY],
  [HazardKeyword.HAZARD_3E, HAMMER],
  [HazardKeyword.HAZARD_3F, HAZARD_DROPPER],
  [HazardKeyword.HAZARD_40, TURRET],
  [HazardKeyword.HAZARD_43, PERIODIC_LAUNCHER],
  [HazardKeyword.HAZARD_48, CAPTURE],
  [HazardKeyword.HAZARD_49, WARP_PAD],
])

export const getHazardBehavior = (keyword: number): HazardBehavior =>
  BEHAVIORS.get(keyword) ?? UNKNOWN
