import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { Checkpoint } from '../../checkpoint/index.ts'
import type { CollisionObject } from '../../collision/index.ts'
import type { ComputerRacerRoute } from '../../computer-racer-route/index.ts'
import type { EventSet } from '../../event/index.ts'
import type { GhostSession } from '../../ghost/index.ts'
import type { HazardList } from '../../hazard/index.ts'
import type { TrackEffect, TrackEmitters, TrackLogicState } from '../../track-logic/index.ts'
import type { Sky, SkyState } from '../../sky/index.ts'
import type { RaceWorlds, WorldAnimation } from '../../world-animation/index.ts'
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
import type { SavedCar } from '../../car-builder/index.ts'
import type { PowerUpPlacements } from '../../power-up/index.ts'
import type { RacerAppearance, RacerFigures } from '../../racer-appearance/index.ts'
import type {
  DebrisAnimations,
  ProjectileEvent,
  ProjectileWorld,
  RouteNode,
} from '../../projectiles/index.ts'
import type { RandomTablePosition } from '../../random-table/index.ts'
import type { FloatArithmetic, Vector3 } from '../../simulation-math/index.ts'
import type { StartPosition } from '../../start-position/index.ts'
import type { TimerList } from '../../timer/index.ts'
import type { TrackMaterial } from '../../track-material/index.ts'
import type { TriggerList } from '../../trigger/index.ts'
import type { SurfaceMaterials } from './surface-materials/surface-materials.types.ts'
import type { PauseMenu, RaceMenuInput } from './pause-menu/pause-menu.types.ts'
import type { PointsRecord } from './points-record/points-record.types.ts'
import type { RaceExit as RaceExitValues } from './race-exit/race-exit.ts'
import type { RacePhase as RacePhaseValues } from './race-phase/race-phase.ts'

export type RacePhase = EnumValues<typeof RacePhaseValues>
export type RaceExit = EnumValues<typeof RaceExitValues>

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
  // The files the car is drawn from, and the figures (wheels, driver) that 0x0043d7a0 binds to them.
  readonly appearance: RacerAppearance
  readonly figures: RacerFigures
  // The racer save a local player's car was built from (its design draws the car body); null for a computer racer.
  readonly savedCar: SavedCar | null
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
  // Race +0x18 != 0: the circuit runner's points record rides along (the results state lasts 5 s).
  readonly isPointsRecordPresent: boolean
  // Race +0x3364: the time trial's ghost object, null in any other race.
  readonly ghost: GhostSession | null
  // The tunes of the race's music list (RAB keyword 0x30, `LEGOMSC`); 0 when the race plays no music.
  readonly musicTuneCount: number
  readonly racers: readonly RaceRacerDefinition[]
  readonly checkpoints: readonly Checkpoint[]
  // The collision world's BVB instances in world order (race +0x3a0, 0x00432e20): the track, the checkpoint object, the
  // start line, ... .
  readonly collisionObjects: readonly CollisionObject[]
  // Their names (the world's lookup table, +0xd8), in the same order.
  readonly collisionObjectNames: readonly string[]
  // The instances every car starts with (race +0x3b0, then +0x3b8): positions in collisionObjects, the track first.
  readonly carCollisionObjectIndices: readonly number[]
  // The race's track materials (RAB keyword 0x43, race +0x27e0); empty when the race names none.
  readonly trackMaterials: readonly TrackMaterial[]
  readonly startPositions: readonly StartPosition[]
  readonly powerUps: PowerUpPlacements
  readonly events: EventSet | null
  readonly timers: TimerList | null
  readonly mainTriggers: TriggerList | null
  readonly environmentTriggers: TriggerList | null
  readonly hazards: HazardList | null
  // Race +0x18: the circuit's points record, null for a single race.
  readonly pointsRecord: PointsRecord | null
  // Game settings +0x1e & 0x40 (meaning not traced): a restart inside a circuit then runs in place.
  readonly isSettingsFlag40Set: boolean
  // The worlds the race animates (race +0x390, +0x398, +0x3a4) and the two emitter pools (race +0x2150, +0x248c); a
  // definition without them has worlds and pools that hold nothing.
  readonly worlds?: RaceWorlds
  readonly emitters?: TrackEmitters
  // Sky_Load 0x0041c550: the sky file and the background world it loads (race +0x2f90).
  readonly sky?: RaceSkyDefinition
  // The random table position (0x004c6ee4) after the loaders that ran before RacerSet_Setup.
  readonly randomPosition: RandomTablePosition
  // The track world's line query 0x0041f4d0 (world module); null answers every query with a miss.
  readonly getGroundPoint: GroundQuery | null
  // The track's TGB points (race +0x32c4), the cannon's and grapple's aims.
  readonly trackTargets: readonly ConeQueryTarget[]
  readonly projectileModelData: ProjectileModelData
}

// Model and route data the moving power-up effects read and the port does not parse yet (projectiles.md).
export type ProjectileModelData = {
  // Racer set +0x10: the route a warping racer follows.
  readonly routeNodes: readonly RouteNode[]
  readonly rocketLaunchMilliseconds: readonly number[]
  readonly debrisAnimations: DebrisAnimations
}

// What a computer racer's power-up code reads that is not racer state (racer +0xcd0, +0xcd4, +0xd1c..).
export type RaceRacerPowerUpSetup = {
  readonly personality: ComputerPowerUpPersonality
  readonly abilities: RacerPowerUpAbilities
}

export type RaceSkyDefinition = {
  readonly sky: Sky
  readonly background: WorldAnimation
}

// The sky at runtime: the settings' time and transition (sky +0xa8..+0xc0) and the background world (sky +0x9c).
export type RaceSky = {
  readonly state: SkyState
  readonly background: WorldAnimation
}

export type RaceState = {
  // Race +0x3328 and +0x332c: the state and the milliseconds spent in it (the unscaled frame times).
  readonly phase: RacePhase
  readonly phaseMilliseconds: number
  // Race +0x3334: Race_RunLoop runs while it is non-zero.
  readonly isRunning: boolean
  // Why the loop ended (race +0x3334 became 0 and the settings flags say what the front end does next).
  readonly exit: RaceExit
  // Race +0x30c0, +0x3058.. and +0x3360: the pause menu.
  readonly pauseMenu: PauseMenu
  // Race +0x18, written when racers get their places and ticked in the results.
  readonly pointsRecord: PointsRecord | null
  // Game settings +0x1e & 0x40.
  readonly isSettingsFlag40Set: boolean
  // Race +0x3364: the ghost object (a time trial); the recorder runs in every sub-step.
  readonly ghost: GhostSession | null
  // The music list's tune count and the tune the music stream (race +0x3320) plays; null without a stream.
  readonly musicTuneCount: number
  readonly tuneIndex: number | null
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
  // Race +0x3104, stride 0x48: the route loaded for each racer slot, null for a slot without one. A racer without a
  // route asks for the nearest of them when the computer takes it over (0x0043d070).
  readonly routes: readonly (ComputerRacerRoute | null)[]
  // Race +0x6d4: the racer each local player drives.
  readonly playerRacerIndices: readonly number[]
  // Race +0x258, stride 0x74.
  readonly playerControllers: readonly PlayerController[]
  // Race +0x6dc: the power-ups, and the events they raised that Race_Update has not handed on yet.
  readonly powerUpStep: PowerUpStep
  readonly powerUpSetups: readonly RaceRacerPowerUpSetup[]
  readonly getGroundPoint: GroundQuery | null
  readonly trackTargets: readonly ConeQueryTarget[]
  // The properties of the collision world's materials (0x00435d20, 0x00435e70).
  readonly surfaces: SurfaceMaterials
  // The names of the collision world's instances (a main trigger names the one it adds to a car's collision list).
  readonly collisionObjectNames: readonly string[]
  // Race +0x32c4 (0x0045e3f0): per racer and per collision world instance, the milliseconds (a byte) that instance
  // stays in the racer's collision list since a trigger last named it (0x0045e520); 0 when it is not there.
  readonly taggedPositionMilliseconds: readonly (readonly number[])[]
  // The objects registered with the collision registry (racer set +0xf0, list +0x48); a registry entry's id is a
  // position in this list.
  readonly registryObjects: readonly RegistryObject[]
  // The moving power-up effects (power-up system +0x193c, +0x1940, +0x18bc and each effect's body).
  readonly projectileWorld: ProjectileWorld
  readonly projectileModelData: ProjectileModelData
  // Events, triggers and timers at runtime (race +0x2098, +0x2080, +0x2128, +0x213c).
  readonly trackLogic: TrackLogicState
  // The effects the track logic asked for and the race has not reported yet.
  readonly trackEffects: readonly TrackEffect[]
  // Loaded and kept; their per-frame logic is not ported (race +0x2080, +0x2128, +0x213c, +0x2148).
  readonly timers: TimerList | null
  readonly mainTriggers: TriggerList | null
  readonly environmentTriggers: TriggerList | null
  readonly hazards: HazardList | null
  // Race +0x2f90, updated by Sky_Update 0x0041ccb0 at the end of Race_Update; null for a race without a sky.
  readonly sky: RaceSky | null
  readonly startPositions: readonly StartPosition[]
}

// What a registry entry stands for (Race_LoadTrackContent registers the main triggers, the environment triggers and
// then the bricks, 0x004653f0 and 0x0045a340; each is prepended to the list).
export type RegistryObject =
  | { readonly type: 'main_trigger'; readonly index: number }
  | { readonly type: 'environment_trigger'; readonly index: number }
  | { readonly type: 'power_up_brick'; readonly index: number }
  | { readonly type: 'enhancement_brick'; readonly index: number }

// What the registry's volumes are read from: the objects, the triggers' state and the bricks.
export type RegistrySource = {
  readonly registryObjects: readonly RegistryObject[]
  readonly trackLogic: TrackLogicState
  readonly powerUpStep: PowerUpStep
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
  // The menu keys of the frame; none when absent.
  readonly menu?: RaceMenuInput
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
  // The music stream starts another tune of the list (0 introduction, 1 and 4+ racing, 2 lose, 3 win).
  | { readonly type: 'race.tune_changed'; readonly tuneIndex: number }
  // 0x00439ba0: a racer crossed the start line into a new lap.
  | {
      readonly type: 'race.racer_started_lap'
      readonly racerIndex: number
      readonly lap: number
    }
  // Race +0x3334 became 0.
  | { readonly type: 'race.ended'; readonly exit: RaceExit }
  // 0x00436010 opened a menu and 0x00436160 closed one.
  | { readonly type: 'race.paused' }
  | { readonly type: 'race.resumed' }
  | { readonly type: 'race.power_up'; readonly event: PowerUpEvent }
  | { readonly type: 'race.projectile'; readonly event: ProjectileEvent }
  | { readonly type: 'race.track_effect'; readonly effect: TrackEffect }

export type RaceStepResult = {
  readonly raceState: RaceState
  readonly events: readonly RaceEvent[]
}

// The race with the power-ups riding on the racer set while a sub-step runs (see race-world).
export type RaceRacerSet = RacerSet &
  Pick<
    RaceState,
    | 'powerUpStep'
    | 'powerUpSetups'
    | 'getGroundPoint'
    | 'trackTargets'
    | 'surfaces'
    | 'collisionObjectNames'
    | 'taggedPositionMilliseconds'
    | 'registryObjects'
    | 'trackLogic'
    | 'trackEffects'
  > & {
    readonly raceModeFlags: number
    readonly pendingContacts: RaceContacts
  }
