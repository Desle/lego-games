# Feature: racer-physics

## Behaviour

The race physics of one car: the rigid body every racer's car body is built on (`0x00440950`, `0x004411d0`, `0x00444b10`), its integrator (`RigidBody_Integrate`, `0x00440e10`), and the car rigid body's whole step, `RigidBody_Step` (`0x00444ef0`): timers, the driving forces (`0x00445500`), ground probes under the four wheels with a triangle cache (`0x00445dc0`), heading and velocity split (`0x00446fd0`, `0x00447330`), hull contacts against the world with the sub-step split (`0x004478b0`) and the contact response (`0x00447cf0`), and the model's lean (`0x004452b0`). Also the way `Race_Update` (`0x00435220`) turns the frame time into sub-steps. Details, field tables and what is not ported are in `.docs/reverse-engineering/physics.md`.

## User flows

- **Create a body**: `createBoxRigidBody` takes a frame (rotation and position), a mass and box dimensions and returns a body at rest with its inertia, inverse inertia and inverse mass.
- **Push a body**: `addForce`, `addTorqueOfForceAtPoint` and `removeAngularMomentumAlongAxis` return the body with updated accumulators or angular momentum.
- **Create a car**: `createCarRigidBody` takes the model's frame and bounding radius, a mass and box dimensions and returns the car rigid body as `0x00444b40` and `0x00444d90` leave it; `setWheelGeometry`, `setHullPoint` and `setLocalCentreOfMass` add the racer's geometry (`0x00446e60`, `0x00446ea0`, `0x00441190`).
- **Drive a car**: `setThrottle`, `setTopSpeed`, `addImpulse`, `setExtraForce`, `setFlaggedTimer` and `setLeaning` are the car rigid body's command slots; the racer sets `turnRadius` directly.
- **Step a car**: `stepCarRigidBody(arithmetic, body, { stepMilliseconds, collisionObjects }, hooks?)` returns the body after one sub-step of `RigidBody_Step`. `hooks` are the four virtual calls the car body overrides; `CAR_RIGID_BODY_HOOKS` is the car rigid body's own behaviour.
- **Integrate a body**: `integrateRigidBody` returns the body after one step of integer milliseconds, with the accumulators cleared, exactly as the original's no-contact path does.
- **Advance the race clock**: `updateRacePhysics` takes the measured frame time and the 1.75× flag, splits the time into sub-steps of at most 40 ms and runs the given sub-step function once per piece. Until racers are ported, `stepRaceSubStepNotYetPorted` stands in for `RacerSet_Step`, the cameras and the ghost recorder.

## Invariants

- Every step is a pure function: it takes plain frozen state and returns new frozen state; nothing reads a clock, the DOM or a random source.
- Time is integer milliseconds until the integrator converts it to float32, as the original does.
- Rounding follows the precision policy of `simulation-math` (`RACE_FPU_PRECISION`).

## Out of scope

The two-point mode (flag `0x8`: `0x00448840`, `0x004464a0`, `0x004465c0`), which throws `TwoPointModeNotPortedError`; the spin and drift start commands (`0x00448160`, `0x00447f30`, the latter in `racer`); the sound objects; `CarBody_Update` (`0x004293f0`, in `racer`); the racer's vehicle, driver and AI; the cameras and the ghost recorder.
