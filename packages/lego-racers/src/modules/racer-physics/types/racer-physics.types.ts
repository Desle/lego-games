import type { CollisionObject, CollisionTriangle } from '../../collision/index.ts'
import type { FloatArithmetic, Matrix3, Vector3 } from '../../simulation-math/index.ts'

// The Gol frame a rigid body moves (rigid body +0x04 points to it; the car body embeds one at +0xe4).
export type RigidBodyFrame = {
  // Frame +0x28..+0x48.
  readonly rotation: Matrix3
  // Frame +0x4c..+0x54.
  readonly position: Vector3
}

// The rigid body base class (constructor 0x00440950, vtable 0x004b0b78); offsets in physics.md.
export type RigidBody = {
  readonly frame: RigidBodyFrame
  readonly linearVelocity: Vector3
  readonly localCentreOfMass: Vector3
  readonly worldCentreOfMass: Vector3
  readonly localInertia: Matrix3
  readonly localInverseInertia: Matrix3
  readonly worldInverseInertia: Matrix3
  readonly angularVelocity: Vector3
  readonly angularMomentum: Vector3
  readonly force: Vector3
  readonly torque: Vector3
  readonly mass: number
  readonly inverseMass: number
  // Box body (0x004411d0, vtable 0x004b0b84) +0xd0..+0xd8.
  readonly dimensions: Vector3
}

export type BoxRigidBodyDefinition = {
  readonly frame: RigidBodyFrame
  readonly mass: number
  readonly dimensions: Vector3
}

export type BoxInertia = {
  readonly localInertia: Matrix3
  readonly localInverseInertia: Matrix3
}

export type RaceTimeStepInput = {
  // Application +0x824: integer milliseconds from timeGetTime, after the frame clamp.
  readonly frameDeltaMilliseconds: number
  // Game settings +0x20 & 0x100.
  readonly isTimeScaled: boolean
}

export type RacePhysicsSubStep<State> = (state: State, stepMilliseconds: number) => State

// One of the car rigid body's four wheels, 0x70 bytes from +0x198 (offsets in the wheel).
export type CarWheel = {
  // +0x00: the triangle normal under the wheel, then (when grounded) its share of the weight (0x00445dc0).
  readonly groundForce: Vector3
  // +0x0c: the wheel's attachment point in world space (0x00448c70).
  readonly anchor: Vector3
  // +0x18, +0x24: the probe segment, in world space or in the probed object's frame.
  readonly probeStart: Vector3
  readonly probeEnd: Vector3
  // +0x30: where the probe met a triangle (also written by probes that missed a cached triangle).
  readonly contactPoint: Vector3
  // +0x3c, +0x40: the material under the wheel, and the one at the start of the step (by name).
  readonly material: string | undefined
  readonly previousMaterial: string | undefined
  // +0x44: the triangle cache entry the wheel last stood on, or -1.
  readonly cachedTriangleIndex: number
  // +0x48 bit 0x1 and bit 0x2.
  readonly isOnGround: boolean
  readonly isProbed: boolean
  // +0x4c: squared distance from the probe end to the contact point.
  readonly depthSquared: number
  // +0x50, +0x54, +0x58, +0x5c: surface values the car body writes (0x0042a900); the physics averages them.
  readonly surfaceDrag: number
  readonly surfaceGrip: number
  readonly surfaceSkidGrip: number
  readonly grip: number
  // +0x60: saved and restored with the step start, otherwise unread here.
  readonly surfaceValue60: number
  // +0x64..+0x6c: a force the surface pushes the car with; the four are averaged and scaled by mass (0x00445500).
  readonly surfaceForce: Vector3
}

// One of the eight triangle cache entries, 0x3c bytes from +0x3f4 (0x00448a70).
export type TriangleCacheEntry = {
  readonly triangle: CollisionTriangle
  // +0x34: sub-steps since a wheel last stood on it.
  readonly age: number
  // +0x38
  readonly material: string | undefined
}

// The wheel fields 0x004474c0 saves and 0x00447690 restores.
export type WheelSnapshot = Pick<
  CarWheel,
  | 'anchor'
  | 'material'
  | 'isOnGround'
  | 'isProbed'
  | 'surfaceDrag'
  | 'surfaceGrip'
  | 'surfaceSkidGrip'
  | 'grip'
  | 'surfaceValue60'
  | 'surfaceForce'
>

// What 0x004474c0 saves at the start of every pass: body +0x684..+0x6bc and the globals 0x004c6df0..0x004c6ee0.
export type StepStartSnapshot = {
  readonly linearVelocity: Vector3
  readonly position: Vector3
  readonly rotation: Matrix3
  readonly worldInverseInertia: Matrix3
  readonly angularVelocity: Vector3
  readonly angularMomentum: Vector3
  readonly twoPointHeight: number
  readonly twoPointTilt: number
  readonly heading: Vector3
  readonly wheels: readonly WheelSnapshot[]
  readonly worldHullPoints: readonly Vector3[]
}

// The car rigid body (constructor 0x00444b10 → 0x00444b40, vtable 0x004b0d8c); offsets in physics.md.
export type CarRigidBody = RigidBody & {
  // +0x13c: the car model's frame; 0x004452b0 leans it, 0x00445dc0 reads its bounding radius (+0x10).
  readonly displayFrame: RigidBodyFrame
  readonly displayBoundingRadius: number
  // +0x15c: mass × 0.001 × 0.001 (0x00444d90).
  readonly scaledMass: number
  // +0x160 (39 after 0x00444b40) and +0x164 = -(gravity × scaled mass), set by every force pass.
  readonly gravity: number
  readonly weight: number
  // +0x168: the unit direction the car drives in.
  readonly heading: Vector3
  // +0x174: the averaged normal of the grounded wheels (or rotation row 2 when three or more are down).
  readonly groundNormal: Vector3
  // +0x180: gravity along the ground, applied when the surface does not hold the car.
  readonly slopeForce: Vector3
  // +0x18c: added to the frame when it settles onto the deepest wheel (0x00448430); (0, 0, 0.2) by default.
  readonly settleOffset: Vector3
  readonly wheels: readonly CarWheel[]
  // +0x358: wheel 1's attachment point in the frame; +0x364 and +0x368 the track width and wheelbase.
  readonly localWheelAnchor: Vector3
  readonly trackWidth: number
  readonly wheelbase: number
  // +0x36c: wheels on the ground; 4 means three or more were, and the body is aligned to the ground.
  readonly groundedWheelCount: number
  // +0x370 and +0x3a0: the four hull points tested against the world, in frame and world space.
  readonly localHullPoints: readonly Vector3[]
  readonly worldHullPoints: readonly Vector3[]
  // +0x3d0..+0x3dc, +0x3e0 and +0x3ec.
  readonly hullContacts: readonly boolean[]
  readonly contactNormal: Vector3
  readonly contactCount: number
  // +0x3f0: milliseconds of the step not yet simulated.
  readonly stepRemaining: number
  // +0x3f4..+0x5d0, count +0x5d4.
  readonly triangleCache: readonly TriangleCacheEntry[]
  // +0x5d8, +0x5dc, +0x5e0: when one runs out, the angular momentum about rotation row 0, 1 or 2 is removed.
  readonly rollTimer: number
  readonly pitchTimer: number
  readonly yawTimer: number
  // +0x5e4, +0x5e8: counted by the spin commands (0x00448160, 0x00448290).
  readonly spinTimer: number
  readonly spinPeriod: number
  // +0x5ec: drag = mass × |throttle| / top speed² (0x004483b0).
  readonly drag: number
  // +0x5f4: scales the averaged surface value +0x5c (0x004489f0).
  readonly gripScale: number
  // +0x5f8 and +0x604: the direction and length of the linear velocity (0x00447330).
  readonly velocityDirection: Vector3
  readonly speed: number
  // +0x608: top speed (110 after 0x00444b40).
  readonly topSpeed: number
  // +0x60c, +0x618, +0x61c: the velocity along the heading, its length, and the rest.
  readonly forwardVelocity: Vector3
  readonly forwardSpeed: number
  readonly lateralVelocity: Vector3
  // +0x628: throttle (slot 5, 0x00448370).
  readonly throttle: number
  // +0x630 and +0x63c: forces added every pass while flags 0x20 and 0x40 are set (0x00448760, 0x004487b0).
  readonly extraForceA: Vector3
  readonly extraForceB: Vector3
  // +0x648: mass × forward speed² / turn radius, the last centripetal force.
  readonly centripetalForce: number
  // +0x64c: turn radius; 0 drives straight.
  readonly turnRadius: number
  // +0x650: the yaw rate the last force pass asked for.
  readonly yawRate: number
  // +0x658..+0x680: the two-point mode's values (flag 0x8; 0x004464a0), saved with the step start.
  readonly twoPointHeight: number
  readonly twoPointTargetHeight: number
  readonly twoPointHeightRate: number
  readonly twoPointTargetTilt: number
  readonly twoPointTilt: number
  // +0x684..+0x6bc
  readonly stepStart: StepStartSnapshot
  // +0x6c0, see CarRigidBodyFlag.
  readonly flags: number
  // +0x6c4, +0x6c8, +0x6cc, +0x6d0: drift parameters (0x00447f30).
  readonly driftYawFactor: number
  readonly driftThreshold: number
  readonly driftMaximumAngle: number
  readonly driftBrake: number
  // +0x6d4 and +0x6d8: the model's lean angle and its factor (0x004452b0, 0x00449070).
  readonly lean: number
  readonly leanFactor: number
  // +0x6dc: milliseconds without a wheel on the ground.
  readonly airborneTime: number
  // +0x6e0: the countdown of flag 0x80 (0x00448800).
  readonly flaggedTimer: number
}

export type CarRigidBodyDefinition = {
  // The car model's frame; the body starts with its rotation and position (0x00444d90).
  readonly displayFrame: RigidBodyFrame
  readonly displayBoundingRadius: number
  readonly mass: number
  readonly dimensions: Vector3
}

// A contact the car body's filter (slot +0xc) is asked about.
export type HullContactQuery = {
  readonly point: Vector3
  readonly material: string | undefined
  readonly collisionObjectIndex: number
  readonly triangle: CollisionTriangle
}

export type HullContactDecision = {
  readonly isAccepted: boolean
  readonly body: CarRigidBody
}

// The virtual calls RigidBody_Step makes, which the car body (vtable 0x004b04e4) overrides.
export type CarRigidBodyHooks = {
  // Slot +0x0c (car body 0x0042a830): may the hull touch this triangle?
  readonly decideHullContact: (body: CarRigidBody, contact: HullContactQuery) => HullContactDecision
  // Slot +0x10 (car body 0x0042a900): runs after every pass (surface effects of the wheels' materials).
  readonly afterPass: (body: CarRigidBody) => CarRigidBody
  // Slot +0x2c (0x004482e0; car body 0x00429cd0): the spin's yaw timer ran out.
  readonly onSpinEnded: (arithmetic: FloatArithmetic, body: CarRigidBody) => CarRigidBody
  // Slot +0x3c (0x00448820; car body 0x00429c30): the flag-0x80 countdown ran out.
  readonly onFlaggedTimerEnded: (body: CarRigidBody) => CarRigidBody
}

// The yaw rate 0x00445500 asks for, with the body after it stored +0x650.
export type TurnYawRate = {
  readonly body: CarRigidBody
  readonly yawRate: number
}

// The deepest probe hit of a pass so far (0x00445dc0: [ESP+0x64], [ESP+0x20]).
export type DeepestWheel = {
  readonly wheelIndex: number
  readonly depthSquared: number
}

// The body and the deepest hit while 0x00445dc0 goes through the collision objects.
export type GroundProbeProgress = {
  readonly body: CarRigidBody
  readonly deepest: DeepestWheel | undefined
}

export type CachedTriangleSearch = {
  readonly isFound: boolean
  readonly body: CarRigidBody
}

export type TriangleCacheInsertion = {
  readonly triangleCache: readonly TriangleCacheEntry[]
  readonly index: number
}

// 0x004478b0's running search: the body, the closest squared distance and that contact's fraction.
export type HullContactSearch = {
  readonly body: CarRigidBody
  readonly closestSquared: number
  readonly fraction: number
}

// 0x004478b0's result: the body (back at the pass start when a contact was found) and the
// milliseconds to simulate before the contact.
export type ContactAdvance = {
  readonly body: CarRigidBody
  readonly remainingMilliseconds: number
}

export type CarRigidBodyStepInput = {
  // Integer milliseconds of one physics sub-step (at most 40, see getPhysicsSubSteps).
  readonly stepMilliseconds: number
  // The body's collision list (+0x140, at most five): the track first, then moving objects.
  readonly collisionObjects: readonly CollisionObject[]
}
