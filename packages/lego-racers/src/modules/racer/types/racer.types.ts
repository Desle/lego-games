import type { Checkpoint } from '../../checkpoint/index.ts'
import type { CollisionObject } from '../../collision/index.ts'
import type { RouteFollower, RubberBand } from '../../racer-ai/index.ts'
import type { CarRigidBody } from '../../racer-physics/index.ts'
import type { RandomTable, RandomTablePosition } from '../../random-table/index.ts'
import type { FloatArithmetic, Quaternion, Vector3 } from '../../simulation-math/index.ts'

// The two lookup tables in LEGORacers.exe that the racer code reads.
export type RacerTables = {
  // 0x004befec, read through the position at 0x004c6ee4.
  readonly randomTable: RandomTable
  // 0x004bf7ec: 1,024 float32 values, a cosine over one turn (index = angle · 1024 / 2π).
  readonly cosineValues: readonly number[]
}

// What the player holds this frame: the nine bindings of the player controller (0x004309c0) and two device axes.
export type RacerControls = {
  // Binding 0, controller flag 0x1: steers towards positive steering.
  readonly isSteerPositivePressed: boolean
  // Binding 1, flag 0x2: steers towards negative steering.
  readonly isSteerNegativePressed: boolean
  // Binding 2, flag 0x4.
  readonly isAcceleratePressed: boolean
  // Binding 3, flag 0x8: negative throttle.
  readonly isBrakePressed: boolean
  // Binding 4, flag 0x10: 0x00439100 uses the held power-up.
  readonly isUsePowerUpPressed: boolean
  // Binding 5, flag 0x20: 0x0043a390 cycles the camera (racer +0xdb4).
  readonly isChangeCameraPressed: boolean
  // Binding 6, flag 0x40: 0x0043a0c0 cycles the HUD mode (racer +0xe30, HUD +0x3c).
  readonly isChangeHudModePressed: boolean
  // Binding 7, flag 0x80: power slide.
  readonly isPowerSlidePressed: boolean
  // Binding 8, flag 0x100: camera +0x04 = 1 while held (hypothesis: look behind).
  readonly isLookBehindPressed: boolean
  // Device axis 1 as the device returns it (float32); the controller negates it.
  readonly steeringAxis: number
  // Device axis 2 (float32), read only when the controller's +0x70 is set.
  readonly throttleAxis: number
}

// What 0x00430120 moves the steering towards: a rate per second and the limits it may not pass.
export type SteeringTarget = {
  readonly speed: number
  readonly upper: number
  readonly lower: number
}

// The two pedal values of 0x00430390: accelerate in [0, 1] and brake in [-1, 0].
export type Pedals = {
  readonly accelerate: number
  readonly brake: number
}

// Player controller (race +0x258, stride 0x74; constructor 0x00430020). Its device bindings (+0x04..+0x58) are not modelled.
export type PlayerController = {
  // +0x5c: one bit per held binding (RacerControls order, bit n = binding n).
  readonly bindingFlags: number
  // +0x60: 0x1 before the start (start boost armed), 0x2 controls disabled (0x00430760), 0x8 accelerating.
  readonly stateFlags: number
  // +0x64: uint32 milliseconds the start boost stays available.
  readonly startBoostMilliseconds: number
  // +0x68: uint32 milliseconds accelerate has been held.
  readonly accelerateMilliseconds: number
  // +0x6c: float32 steering in [-1, 1].
  readonly steering: number
  // +0x70: non-zero when throttle comes from device axis 2 (set for a "Microsoft SideWinder Force Feedback" wheel, 0x004307f0).
  readonly isThrottleAxisEnabled: boolean
}

// Racer driver (racer +0xc70, constructor 0x0041fb80): turns steering and throttle into car body commands.
export type RacerDriver = {
  // +0x04: route time (float32) when following a route (flag 0x40); not used by the ported code.
  readonly routeTime: number
  // +0x08: float32 curvature of the previous step.
  readonly previousCurvature: number
  // +0x0c: float32 curvature asked for (1 / turning radius, signed).
  readonly curvature: number
  // +0x10: float32 throttle force.
  readonly throttle: number
  // +0x14: flags. 0x1 full throttle, 0x2 hold, 0x4 power slide, 0x8 slide boost, 0x10 wobble, 0x20 reversing on a route, 0x40 on a route, 0x80 no route, 0x100 full throttle while touching.
  readonly flags: number
  // +0x18, +0x1c: float32 random wobble added while flag 0x10 is set.
  readonly wobbleSteering: number
  readonly wobbleThrottle: number
  // +0x20: uint32 milliseconds until the next wobble.
  readonly wobbleMilliseconds: number
  // +0x24: uint32 route step (0x004203b0).
  readonly routeStepMilliseconds: number
  // +0x28: uint32 milliseconds standing still on a route (0x0041fdb0).
  readonly stuckMilliseconds: number
  // +0x2c: uint32 milliseconds of the current power slide or slide boost.
  readonly slideMilliseconds: number
  // +0x30: power slide direction passed to 0x00420260 (1 when braking).
  readonly slideDirection: number
}

// The driver acts on its car body (driver +0x00 points to it), so its functions return both.
export type DrivenCarBody = {
  readonly driver: RacerDriver
  readonly carBody: CarBody
}

// RacerDriver_Update also draws from the random table.
export type DriverUpdate = DrivenCarBody & {
  readonly randomPosition: RandomTablePosition
}

// What both steering branches of 0x0041fee0 work on.
export type SteeringRequest = {
  readonly arithmetic: FloatArithmetic
  readonly tables: RacerTables
  readonly driven: DrivenCarBody
  readonly curvature: number
  readonly magnitude: number
}

// A driver after drawing its wobble.
export type DriverWobble = {
  readonly driver: RacerDriver
  readonly randomPosition: RandomTablePosition
}

// The car body (racer +0x3e8, 0x888 bytes; constructor 0x00429020, vtable 0x004b04e4).
// Everything up to +0x6e0 is the car rigid body (racer-physics' CarRigidBody), which RigidBody_Step 0x00444ef0 steps.
export type CarBody = {
  // +0x00..+0x6e0: the car rigid body, its embedded frame (+0xe4) and its display frame (+0x13c).
  readonly rigidBody: CarRigidBody
  // +0xdc: float32, 1.0 after 0x00441210; set by pass 7 from the fade timer (hypothesis: a fade or blink factor).
  readonly fadeFactor: number
  // +0x6f0: the racer; its flags (+0xd04) are read through the racer, see CarBody_Update.
  // +0x700..+0x708: float32 last safe position; +0x70c..+0x718: its rotation as a quaternion (x, y, z, w).
  readonly safePosition: Vector3
  readonly safeOrientation: Quaternion
  // +0x728: float32 steering scale (0x0041fe60); +0x72c: float32 throttle scale (0x0042ad30).
  readonly steeringScale: number
  readonly throttleScale: number
  // +0x744: non-zero when the body follows a script (0x00429d40) instead of RigidBody_Step.
  readonly isScripted: boolean
  // +0x778: float32 route speed factor (racer-ai's ComputerSpeedState.speedFactor).
  readonly speedFactor: number
  // +0x7e8, +0x7ec: float32 default and current target speed factors, set by the rubber band (pass 9).
  readonly defaultTargetSpeedFactor: number
  readonly targetSpeedFactor: number
  // +0x7d4, +0x7d8: float32 length and elapsed time of a scripted body's spin (0x00429c40).
  readonly scriptedSpinPeriod: number
  readonly scriptedSpinTime: number
  // +0x74c: the route follower of a scripted body (0x78 bytes); null while the body has no route.
  readonly routeFollower: RouteFollower | null
  // +0x748: non-zero holds a scripted body still (0x004374c0 sets it, 0x00439340 clears it at the start).
  readonly isRouteHeld: boolean
  // +0x77c: float32 time of the ramped target (flag 0x10000); nothing in the ported code writes it.
  readonly rampMilliseconds: number
  // +0x7cc: float32 sideways offset from the route, returning to 0.
  readonly lateralOffset: number
  // +0x7c8, +0x7d0: float32 bounce height above the route and its vertical speed.
  readonly bounceHeight: number
  readonly bounceVerticalSpeed: number
}

// The two forces a car body can carry (car rigid body +0x630 and +0x63c).
export type CarBodyPushSlot = 'extraForceA' | 'extraForceB'

// What the car body's attach (0x00429210 → 0x00444d90) sets up; the rest starts as 0x00429120 leaves it.
export type CarBodyDefinition = {
  readonly rigidBody: CarRigidBody
  readonly steeringScale: number
  readonly throttleScale: number
}

// The force-feedback effect of a racer (racer +0x14, 0x00421f30): an output to the player's device that only
// 0x00422100 and its siblings write in this module.
export type ForceFeedbackEffect = {
  // +0x00: non-zero when the player has a force-feedback device.
  readonly isPresent: boolean
  // +0x04 and +0x0c: the strength and the duration asked for (100 for 0x00422100, 150 for 0x004220e0).
  readonly strength: number
  readonly duration: number
  // +0x10
  readonly phase: number
  // +0x18: 0 idle, 2 restart requested by 0x00421f30; +0x1c cleared by it.
  readonly state: number
  readonly elapsed: number
}

// One animation record of a figure's animation set (figure +0xa8 -> +0x2c, 0x28 bytes each).
export type FigureAnimation = {
  // +0x00: float32 playback rate per millisecond.
  readonly rate: number
  // +0x04..+0x0c: float32 vector the animation puts the figure's offset at.
  readonly vector: Vector3
  // +0x10..+0x18 and +0x1c: float32 centre and radius of the bounding sphere in this animation.
  readonly boundsCentre: Vector3
  readonly boundsRadius: number
  // +0x24 and +0x26: uint16 frame count and the period times wrap at.
  readonly frameCount: number
  readonly period: number
}

// The model part a figure holds at +0x78 (its +0x28..+0x30 centre, +0x34 radius and +0x38 radius scale).
export type FigureChild = {
  readonly centre: Vector3
  readonly radius: number
  readonly radiusScale: number
}

// A figure (class 0x004af5ec, constructor 0x0040d530, 0xf4 bytes): a frame with an animation player. The racer's
// display frame (racer +0x5c, vehicle +0x44) and the driver (vehicle +0x48) are figures.
export type Figure = {
  // +0x5c: 0x10000 plays, 0x20000 blends towards the target, 0x40000 loops, 0x80000 ended, 0x100000 chains to
  // the target animation, 0x400000 the target loops, 0x2000000 wrapped this update.
  readonly flags: number
  // +0xbc and +0xd8: uint16 ids of the current and the target animation.
  readonly currentId: number
  readonly targetId: number
  // +0xb4, +0xb8: float32 time (frames) and rate of the current animation; +0xd0, +0xd4 of the target.
  readonly currentTime: number
  readonly currentRate: number
  readonly targetTime: number
  readonly targetRate: number
  // +0xec and +0xf0: float32 blend position in [0, 1] and its rate per millisecond.
  readonly blend: number
  readonly blendRate: number
  // +0xcc and +0xe8: whether the current and the target animation advance while blending.
  readonly isCurrentAdvancing: boolean
  readonly isTargetAdvancing: boolean
  // +0xc0..+0xc8, +0xdc..+0xe4 and +0x1c..+0x24: float32 vectors of the current animation, the target and the blend.
  readonly currentVector: Vector3
  readonly targetVector: Vector3
  readonly outputVector: Vector3
  // +0x58: float32 scale.
  readonly scale: number
  readonly animations: readonly FigureAnimation[]
  readonly child: FigureChild | null
}

// 0x0040dd60's blend step: the figure after it and the milliseconds left for the plain advance.
export type FigureBlend = {
  readonly figure: Figure
  readonly remainingMilliseconds: number
}

// A figure's bounding sphere in its own space (0x0040e0b0).
export type FigureBounds = {
  readonly centre: Vector3
  readonly radius: number
}

// The vehicle (racer +0x18, constructor 0x0043d5a0, update 0x0043e070) as far as the ported code goes: the animated
// driver and the state that decides which animation plays next. Its particle emitters and sounds are presentation.
export type Vehicle = {
  // +0x48: the driver figure (vehicle animations 0..0x11).
  readonly driverFigure: Figure
  // +0x40: the optional second chassis figure (racer +0x58), whose rate follows the wheels.
  readonly secondFigure: Figure | null
  // +0x384: reactions asked for since the last update (1 start boost, 2 hit); cleared by 0x0043ec10.
  readonly reactionFlags: number
  // +0x388: uint32 milliseconds until the driver may look at another racer again.
  readonly lookMilliseconds: number
  // +0x38c: float32 forward speed of the previous update.
  readonly previousForwardSpeed: number
  // +0x380: index of the racer the driver looks at, or -1.
  readonly watchedRacerIndex: number
  // +0x270, +0x274, +0x278: the effect emitters (smoke and dust) that exist, as the milliseconds they have lived
  // (null when absent). Only the presentation layer creates them, so they stay null here; 0x0043e070 draws from the
  // random table for the first two while they live.
  readonly smokeEmitterAge: number | null
  readonly dustEmitterAge: number | null
  readonly boostEmitterAge: number | null
}

// The racer (0xe34 bytes; constructor 0x00436990, field reset 0x00436bd0). Only the fields the ported passes touch.
export type Racer = {
  readonly carBody: CarBody
  readonly driver: RacerDriver
  // +0x5c: the display figure (the car body's display frame, vehicle +0x44).
  readonly figure: Figure
  // +0x18: the vehicle.
  readonly vehicle: Vehicle
  // +0x3b4 (vehicle +0x39c): float32 written by pass 3 (0x00437b50) while power sliding.
  readonly vehicleSlideAngle: number
  // +0xcc4: index of the current checkpoint in RacerSetContext.checkpoints, or -1 (a null pointer).
  readonly checkpointIndex: number
  // +0xcc8: 1 when the racer was on the positive side of the checkpoint's direction when it last touched it.
  readonly checkpointSide: number
  // +0xce8: int32 count of start line crossings, -1 before the first.
  readonly lapCrossings: number
  // +0xd0c, +0xd10, +0xd14: the trigger zone entered last, the one before and the one before that (0, 1 or 2).
  readonly zoneCurrent: number
  readonly zonePrevious: number
  readonly zoneBeforePrevious: number
  // +0xd6c: shield level while flag 0x1 is set (power-ups' racer_shield_raised).
  readonly shieldLevel: number
  // +0xccc: kind of the held power-up (0 = none).
  readonly heldPowerUp: number
  // +0xcd8, +0xcdc: uint32 milliseconds since the computer last considered its power-up, and the interval (150).
  readonly powerUpThinkMilliseconds: number
  readonly powerUpThinkIntervalMilliseconds: number
  // +0xce0: uint8 lap count; +0xce4: current lap; +0xcec..+0xcfc: uint32 time of each lap.
  readonly lapCount: number
  readonly currentLap: number
  readonly lapMilliseconds: readonly number[]
  // +0xd00: uint32 race position, 1 = first (0x0043a210). Not set by 0x00436bd0.
  readonly racePosition: number
  // +0xd04: flags. 0x2 finished, 0x8, 0x10, 0x80 power sliding, 0x400, 0x800 timed effect, 0x1000, 0x2000/0x4000 wrong way, 0x8000, 0x10000/0x20000, 0x8000000, 0x10000000 fading, 0x20100000 exempt from the rubber band.
  readonly flags: number
  // +0xd08: 0 = player, 2 = computer (0x0043a0e0 switches a finished player to 2).
  readonly controllerKind: number
  // +0xd18: int32 lap number, -1 before the first line.
  readonly lap: number
  // +0xd1c..+0xd21: uint8 power-up chances of a computer racer (0xff after reset).
  readonly powerUpChances: readonly number[]
  // +0xd34: uint32 milliseconds until the computer's next proximity check (0x0043ca60).
  readonly proximityCheckMilliseconds: number
  // +0xd40: voice base (1000); +0xd44: uint32 milliseconds until the next voice (0x00439240).
  readonly voiceBase: number
  readonly voiceMilliseconds: number
  // +0xd48: uint32 milliseconds of fading (flag 0x10000000).
  readonly fadeMilliseconds: number
  // +0xd4c: uint32 milliseconds until the next collision sound.
  readonly collisionSoundMilliseconds: number
  // +0xd50: uint32 milliseconds with no wheel on the ground.
  readonly airborneMilliseconds: number
  // +0xd74, +0xd84: uint32 countdowns whose meaning is not identified.
  readonly unidentifiedCountdownD74Milliseconds: number
  readonly unidentifiedCountdownD84Milliseconds: number
  // +0xd78: uint32 wrong-way countdown (0x00439cf0).
  readonly wrongWayMilliseconds: number
  // +0xd7c: uint32 milliseconds left of the timed effect (flag 0x800, ended by 0x00439b00).
  readonly timedEffectMilliseconds: number
  // +0xe08, +0xe14, +0xe20: the display frame's position, the body's velocity and the display frame's row 0, saved by pass 7.
  readonly savedPosition: Vector3
  readonly savedVelocity: Vector3
  readonly savedForward: Vector3
  // +0x14: the force-feedback effect.
  readonly forceFeedback: ForceFeedbackEffect
  // +0xd6c: what a racer with flag 0x1 does to the one it hits: 1 kicks it sideways, 2 and 3 spin it.
  readonly attackKind: number
  // +0xd70: 1 or 2 while the kick of 0x00438e60 runs (which car body command to undo), 0 otherwise.
  readonly reactionKind: number
  // +0xd80: non-zero while the racer carries a timed effect it can pass on (set to 1000 by 0x00439900).
  readonly timedEffectCharge: number
  // +0xdf8: the point a player is guided to (0x00439e60 sets it with flag 0x8000, 0x00439e90 clears the flag).
  readonly guidanceTarget: Vector3
  // The 750 ms timer 0x00438e60 adds to the collision manager (milliseconds counted so far), or null when none runs.
  readonly contactTimerMilliseconds: number | null
}

// One entry of the ranking array (0x004c67b0, stride 12: racer, distance, progress).
export type RankingEntry = {
  readonly racerIndex: number
  readonly distance: number
  readonly progress: number
}

// The racer set (race +0x3bc).
export type RacerSet = {
  // +0x140 (array, stride 0xe34) and +0x144 (count).
  readonly racers: readonly Racer[]
  // Racer set +0x284 (racer-ai's rubber band).
  readonly rubberBand: RubberBand
  // Global 0x004c6ee4: the random table position, shared by every user of the table.
  readonly randomPosition: RandomTablePosition
  // Racer set +0xf0 (the collision manager, vtable 0x004b0aa8): the racers' nodes in list order (list +0x2c), as indexes.
  // The list is sorted by the display bounding sphere's lowest x on every step, so the order is state.
  readonly collisionOrder: readonly number[]
}

// Constant inputs of a race step.
export type RacerSetContext = {
  readonly arithmetic: FloatArithmetic
  readonly tables: RacerTables
  // Racer set +0x148, the race's checkpoints (the checkpoint module's CPB list).
  readonly checkpoints: readonly Checkpoint[]
  // Every car rigid body's collision list (+0x140): the track's BVB instance, then the moving objects.
  readonly collisionObjects: readonly CollisionObject[]
  // 0x004bef70, written by Race_LoadTrackContent from race +0x3348: the number of laps of the race.
  readonly raceLapCount: number
}

// A call into code this module does not port. It receives and returns the whole set so it can move the random cursor.
export type RacerBoundary = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  stepMilliseconds: number
) => RacerSet

export type RacerSetBoundary = (
  context: RacerSetContext,
  racerSet: RacerSet,
  stepMilliseconds: number
) => RacerSet

// Everything RacerSet_Step 0x0043c030 calls that is not ported here.
export type RacerSetStepDependencies = {
  // Pass 1, figure +0x14 & 0x80 clear and +0x98 == 2 with flag 0x40: route following, 0x004203b0.
  readonly followDriverRoute: RacerBoundary
  // Pass 2: RigidBody_Step 0x00444ef0 (car rigid body vtable 0x004b0d8c slot 1).
  readonly stepRigidBody: RacerBoundary
  // Pass 2: CarBody_StepOnRoute 0x00429d40 when car body +0x744 is set (computer racers; racer-ai's route follower).
  readonly stepScriptedCarBody: RacerBoundary
  // Pass 2: the engine sound block of CarBody_Update (car body +0x738..+0x740, 0x0042b060). Audio only.
  readonly updateEngineSound: RacerBoundary
  // Pass 3: the vehicle effects of 0x00439870 (0x0043dcd0, sound 0x41). Presentation only.
  readonly endPowerSlideEffects: RacerBoundary
  // Pass 4: racer set +0xf0, vtable 0x004b0aa8 slot 4 (0x0043d180): racer-against-racer collisions.
  readonly collideRacers: RacerSetBoundary
  // Pass 5: Vehicle_Update 0x0043e070 and the display wheel angle (0x004401b0, 0x004401e0). Moves the random cursor.
  readonly updateVehicle: RacerBoundary
  // Pass 6: 0x00437d40 and 0x00437be0, the racer's looped sounds. Audio only.
  readonly updateRacerSounds: RacerBoundary
  // Pass 7: 0x00438f20, a computer racer considering its power-up (moves the random cursor, may call 0x00439100).
  readonly considerComputerPowerUp: RacerBoundary
  // Pass 7: 0x004397b0, car body slot 0x3c, when car body +0x6c0 & 0x80 and +0x744 is 0.
  readonly endCarBodyEffect: RacerBoundary
  // Pass 7: 0x00439b00, the end of the timed effect (flag 0x800).
  readonly endTimedEffect: RacerBoundary
  // Pass 7: Racer_Taunt 0x00439c90 (voice and event 0x00462580) when a racer is near ahead.
  readonly tauntNearestRacer: RacerBoundary
  // Pass 7: 0x00439cf0 and 0x00439ea0 for player racers (wrong way and target direction).
  readonly updatePlayerGuidance: RacerBoundary
  // Pass 7: 0x00422100 on racer +0x14 while car body +0x3ec is set.
  readonly notifyRacerContact: RacerBoundary
  // Pass 7: power-ups 0x0045b1e0 (racer +0x08, kind 2) when flag 0x8000000 is set and 0x8 is clear.
  readonly triggerPowerUpEffect: RacerBoundary
  // Pass 8: the sound of the racer nearest to racer set +0x170 (racer set +0x16c). Audio only.
  readonly updateNearestRacerSound: RacerSetBoundary
}

// What the collision response of two racers (0x00438560) calls that this module does not port.
export type RacerCollisionDependencies = {
  // 0x00429680 on a scripted car body: the route follower is moved by the displacement (0x004a5750, 0x0042a290, 0x0042a570).
  readonly separateScriptedCarBody: (
    context: RacerSetContext,
    racerSet: RacerSet,
    racerIndex: number,
    displacement: Vector3
  ) => RacerSet
  // 0x00439900 (thiscall on the receiver: the giver's figure and +0xd7c): passes a timed effect on.
  readonly transferTimedEffect: (
    context: RacerSetContext,
    racerSet: RacerSet,
    receiverIndex: number,
    giverIndex: number
  ) => RacerSet
  // 0x00439b00, the end of the giver's timed effect.
  readonly endTimedEffect: RacerBoundary
}

// Racer set step input.
export type RacerSetStepInput = {
  readonly context: RacerSetContext
  readonly racerSet: RacerSet
  readonly stepMilliseconds: number
  readonly dependencies: RacerSetStepDependencies
}

// Calls the player controller makes into other subsystems when a binding is pressed or released.
export type PlayerControllerDependencies = {
  // Binding 4 press: 0x00439100 (use the held power-up), skipped while controller +0x60 & 3.
  readonly usePowerUp: RacerBoundary
  // Binding 5 press: 0x0043a390 (camera).
  readonly changeCamera: RacerBoundary
  // Binding 6 press: 0x0043a0c0 (HUD mode).
  readonly changeHudMode: RacerBoundary
  // Binding 8 press and release: 0x0043a3f0 / 0x0043a400 (camera +0x04).
  readonly setLookBehind: (
    context: RacerSetContext,
    racerSet: RacerSet,
    racerIndex: number,
    isLookingBehind: boolean
  ) => RacerSet
  // 0x00430790: power-ups 0x0045b1e0 with (start boost > 59) and the smoke of 0x0043df90, for the start boost.
  readonly triggerStartBoost: (
    context: RacerSetContext,
    racerSet: RacerSet,
    racerIndex: number,
    isStrongBoost: boolean
  ) => RacerSet
  // 0x004397c0 and 0x00439870: the vehicle effects and sounds of starting or ending a power slide. Presentation only.
  readonly startPowerSlideEffects: RacerBoundary
  readonly endPowerSlideEffects: RacerBoundary
}

// One player's controller together with the racer set it drives.
export type PlayerControllerState = {
  readonly controller: PlayerController
  readonly racerSet: RacerSet
}

export type PlayerControllerInput = {
  readonly context: RacerSetContext
  readonly state: PlayerControllerState
  readonly racerIndex: number
  readonly dependencies: PlayerControllerDependencies
}
