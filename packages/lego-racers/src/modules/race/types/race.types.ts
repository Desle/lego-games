import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { Checkpoint } from '../../checkpoint/index.ts'
import type { CollisionObject } from '../../collision/index.ts'
import type { ComputerRacerRoute } from '../../computer-racer-route/index.ts'
import type { HazardList } from '../../hazard/index.ts'
import type {
  CarBodyDefinition,
  PlayerController,
  RacerControls,
  RacerSet,
  RacerSetContext,
  RacerTables,
} from '../../racer/index.ts'
import type {
  BrickContact,
  ComputerPowerUpPersonality,
  ConeQueryTarget,
  GroundQuery,
  PowerUpEvent,
  PowerUpStep,
  RacerPowerUpAbilities,
} from '../../power-ups/index.ts'
import type { PowerUpPlacements } from '../../power-up/index.ts'
import type { RandomTablePosition } from '../../random-table/index.ts'
import type { FloatArithmetic, Vector3 } from '../../simulation-math/index.ts'
import type { StartPosition } from '../../start-position/index.ts'
import type { TimerList } from '../../timer/index.ts'
import type { TriggerList } from '../../trigger/index.ts'
import type { RacePhase as RacePhaseValues } from './race-phase/race-phase.ts'

export type RacePhase = EnumValues<typeof RacePhaseValues>

// One racer of the race: what Race_LoadTrackContent 0x00433480 and RacerSet_Setup 0x0043b190 take from the
// game settings (+0x100 count, +0x114 + 0x5c·i kind) and the driver, champion and chassis databases (0x0043b480).
export type RaceRacerDefinition = {
  // Settings +0x114 + 0x5c·i: 0 is a player, 2 a computer racer.
  readonly controllerKind: number
  // What 0x004371c0 builds from the chassis and the champion (racer-setup's createCarBodySetup).
  readonly carBody: CarBodyDefinition
  // Race +0x3104 + 0x48·i (racer +0xe2c), chosen by computer-racer-route; null for a racer without a route.
  readonly route: ComputerRacerRoute | null
  // Description +0x6c..+0x71: the driver's personality bytes (100 each for a car built from bricks).
  readonly personalityBytes: readonly number[]
  // Description +0x7c and +0x80 → racer +0xcd0 and +0xcd4: the power-up the driver holds out for.
  readonly preferredPowerUpKind: ComputerPowerUpPersonality['preferredKind']
  readonly preferredPowerUpLevel: number
  // Description +0x74 → racer +0xd40.
  readonly voiceBase: number
}

// Everything the race is built from; the parsed files and the settings Race_LoadRaceDescription reads.
export type RaceDefinition = {
  readonly arithmetic: FloatArithmetic
  readonly tables: RacerTables
  // Game settings +0x20 (bit 0x100 is the 1.75× time scale; the rest is read by power-ups).
  readonly raceModeFlags: number
  // Game settings +0x32c: 0 starts a demonstration (one computer-driven racer, race +0x3350).
  readonly localPlayerCount: number
  // Game settings +0x2c: the lap count when two or more players share the screen; otherwise it is 3.
  readonly multiplayerLapCount: number
  // Game settings +0x1e bit 2 (race +0x335c): the countdown is skipped.
  readonly isCountdownSkipped: boolean
  // Race_LoadTrackContent's argument: the track is mirrored (bias 0.05 for the rubber band).
  readonly isMirrored: boolean
  readonly racers: readonly RaceRacerDefinition[]
  readonly checkpoints: readonly Checkpoint[]
  // Every car rigid body's collision list: the track's COLLIDE.BVB first, then the moving objects.
  readonly collisionObjects: readonly CollisionObject[]
  readonly startPositions: readonly StartPosition[]
  readonly powerUps: PowerUpPlacements
  readonly timers: TimerList | null
  readonly mainTriggers: TriggerList | null
  readonly environmentTriggers: TriggerList | null
  readonly hazards: HazardList | null
  // The random table position (0x004c6ee4) after the loaders that ran before RacerSet_Setup.
  readonly randomPosition: RandomTablePosition
  // The track world's line query 0x0041f4d0 (world module); null answers every query with a miss.
  readonly getGroundPoint: GroundQuery | null
  // The track's TGB points (race +0x32c4), the cannon's and grapple's aims.
  readonly trackTargets: readonly ConeQueryTarget[]
}

// What a computer racer's power-up code reads that is not racer state (racer +0xcd0, +0xcd4, +0xd1c..).
export type RaceRacerPowerUpSetup = {
  readonly personality: ComputerPowerUpPersonality
  readonly abilities: RacerPowerUpAbilities
}

export type RaceState = {
  // Race +0x3328 and +0x332c: the state and the milliseconds spent in it (the unscaled frame times).
  readonly phase: RacePhase
  readonly phaseMilliseconds: number
  // Race +0x3334: Race_RunLoop runs while it is non-zero.
  readonly isRunning: boolean
  // Race +0x3330: how many racers have been given a final place.
  readonly finishedRacerCount: number
  // Race +0x3348 (byte): the laps to race.
  readonly lapCount: number
  // Race +0x3354: two or more local players.
  readonly isMultiplayer: boolean
  // Race +0x3350: a demonstration; racer 0 is driven by the computer.
  readonly isDemonstration: boolean
  // Race +0x335c.
  readonly isCountdownSkipped: boolean
  // Race +0x334c: counted down by Race_Update, back to 1,000 when the step exceeds it; nothing reads it here.
  readonly unidentifiedCountdownMilliseconds: number
  // Game settings +0x20.
  readonly raceModeFlags: number
  // Game settings +0x15e + 0x5c·i: the final place of each racer, written when the finishing state ends.
  readonly placements: readonly number[]
  readonly context: RacerSetContext
  // Race +0x3bc: the racers, the rubber band and the random table position.
  readonly racerSet: RacerSet
  // Race +0x6d4: the racer each local player drives.
  readonly playerRacerIndices: readonly number[]
  // Race +0x258, stride 0x74.
  readonly playerControllers: readonly PlayerController[]
  // Race +0x6dc: the power-ups, and the events they raised that Race_Update has not handed on yet.
  readonly powerUpStep: PowerUpStep
  readonly powerUpSetups: readonly RaceRacerPowerUpSetup[]
  readonly getGroundPoint: GroundQuery | null
  readonly trackTargets: readonly ConeQueryTarget[]
  // Loaded and kept; their per-frame logic is not ported (race +0x2080, +0x2128, +0x213c, +0x2148).
  readonly timers: TimerList | null
  readonly mainTriggers: TriggerList | null
  readonly environmentTriggers: TriggerList | null
  readonly hazards: HazardList | null
  readonly startPositions: readonly StartPosition[]
}

// A racer's car touched a checkpoint's collision object (0x0042a830 → 0x00439fc0).
export type CheckpointTouch = {
  readonly racerIndex: number
  readonly checkpointIndex: number
  // The contact record's vector at +0x24..+0x2c, dotted with the checkpoint's plane normal.
  readonly direction: Vector3
}

// A racer overlapped a main trigger (0x00463c70) whose first integer is the zone 0, 1 or 2 (0x00464680).
export type ZoneCrossing = {
  readonly racerIndex: number
  readonly zone: number
}

// What the rigid-body contacts and the collision registry (racer set +0xf0, 0x0043d270) report for a frame; they
// are not ported, so the caller delivers them. They are applied in the frame's first sub-step, in pass 4.
export type RaceContacts = {
  readonly checkpointTouches: readonly CheckpointTouch[]
  readonly zoneCrossings: readonly ZoneCrossing[]
  readonly brickContacts: readonly BrickContact[]
  readonly enhancementBrickContacts: readonly BrickContact[]
}

export type RaceInputs = {
  // One per local player, in the order of RaceState.playerRacerIndices.
  readonly controls: readonly RacerControls[]
  readonly contacts: RaceContacts
}

export type RaceEvent =
  | { readonly type: 'race.phase_changed'; readonly from: RacePhase; readonly to: RacePhase }
  // 0x00430710: the players' controls are released at the start.
  | { readonly type: 'race.controls_enabled' }
  // 0x0043a210 with the next place, once per racer.
  | {
      readonly type: 'race.racer_finished'
      readonly racerIndex: number
      readonly place: number
    }
  // 0x00439ba0: a racer crossed the start line into a new lap.
  | {
      readonly type: 'race.racer_started_lap'
      readonly racerIndex: number
      readonly lap: number
    }
  // Race +0x3334 became 0.
  | { readonly type: 'race.ended' }
  | { readonly type: 'race.power_up'; readonly event: PowerUpEvent }

export type RaceStepResult = {
  readonly raceState: RaceState
  readonly events: readonly RaceEvent[]
}

// The race with the power-ups riding on the racer set while a sub-step runs (see race-world).
export type RaceRacerSet = RacerSet & {
  readonly powerUpStep: PowerUpStep
  readonly powerUpSetups: readonly RaceRacerPowerUpSetup[]
  readonly getGroundPoint: GroundQuery | null
  readonly trackTargets: readonly ConeQueryTarget[]
  readonly raceModeFlags: number
  readonly pendingContacts: RaceContacts
}
