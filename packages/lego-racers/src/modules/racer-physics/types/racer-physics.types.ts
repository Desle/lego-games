import type { Matrix3, Vector3 } from '../../simulation-math/index.ts'

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
