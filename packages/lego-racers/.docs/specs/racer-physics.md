# Feature: racer-physics

## Behaviour

The start of the race simulation: the rigid body every racer's car body is built on (`0x00440950`, `0x004411d0`, `0x00444b10`), its force and torque accumulators, its integration step without contacts (`RigidBody_Integrate`, `0x00440e10`), and the way `Race_Update` (`0x00435220`) turns the frame time into physics sub-steps. Details, field tables and what is not ported yet are in `.docs/reverse-engineering/physics.md`.

## User flows

- **Create a body**: `createBoxRigidBody` takes a frame (rotation and position), a mass and box dimensions and returns a body at rest with its inertia, inverse inertia and inverse mass.
- **Push a body**: `addForce`, `addTorqueOfForceAtPoint` and `removeAngularMomentumAlongAxis` return the body with updated accumulators or angular momentum.
- **Integrate a body**: `integrateRigidBody` returns the body after one step of integer milliseconds, with the accumulators cleared, exactly as the original's no-contact path does.
- **Advance the race clock**: `updateRacePhysics` takes the measured frame time and the 1.75× flag, splits the time into sub-steps of at most 40 ms and runs the given sub-step function once per piece. Until racers are ported, `stepRaceSubStepNotYetPorted` stands in for `RacerSet_Step`, the cameras and the ghost recorder.

## Invariants

- Every step is a pure function: it takes plain frozen state and returns new frozen state; nothing reads a clock, the DOM or a random source.
- Time is integer milliseconds until the integrator converts it to float32, as the original does.
- Rounding follows the precision policy of `simulation-math` (`RACE_FPU_PRECISION`).

## Out of scope

Contacts and collisions (`RigidBody_AdvanceToContact` `0x004478b0`), the rest of `RigidBody_Step` (`0x00444ef0`: forces `0x00445500`, suspension and surface code, timers, sounds), `CarBody_Update` (`0x004293f0`), the racer's vehicle, driver and AI, the cameras and the ghost recorder.
