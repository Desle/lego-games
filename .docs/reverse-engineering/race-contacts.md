# Race contacts, collision list, race end

Ported in `packages/lego-racers/src/modules/race` (and the modules it uses). Everything is traced to `LEGORacers.exe`; **hypothesis** marks what is not proven. Related: [race.md](race.md), [collision.md](collision.md), [physics.md](physics.md), [racer-setup.md](racer-setup.md).

## Car body contact filter

- `0x0042a830` (hull contact filter, called by the rigid body for every triangle hit). A material whose name starts with a digit, on the checkpoint object (`race +0x3b8`), is a checkpoint touch (checkpoint number = position in the object's digit-named materials, in list order): it records the touch with the contact direction and the hull does not collide. A track material with flag `0x10000` lets the hull pass; flag `0x8` raises its hit event (`thirdInteger`); flag `0x40000` records a finish touch and stays a wall. No track-material entry: a normal wall.
- `0x0042a900` (after each pass): per wheel on the ground, the surface values from the material (drag `0x8000`, grip `0x800`, skid grip, wheel grip, force `0x40`); defaults 0.5 / 0.25 / 3.0 / 1.0 (`0x004b0460`, `0x004b0464`, `0x004b0458`, `0x004b045c`). Entering a new material raises its enter event (flag `0x2`), leaving raises the leave event (flag `0x4`); two wheels entering or leaving together announce once.
- `0x00439fc0`: the side is `(z*nz + y*ny) + x*nx` not below 0; a lap is counted when progress 0 is crossed forwards.
- Verified: `car-body-contacts.differential.spec.ts` (0x0042a830, 1,500 random cases in both x87 precisions, bit for bit on acceptance, checkpoint, side, lap, zones, flags). `0x0042a900` has unit tests only (**no differential spec yet**).

## Scripted car body

- `0x00429d40`/`0x0042a220`: the loop advances to contact (`RigidBody_AdvanceToContact`) with the track test off, saves the step start, clears contacts and uses the contact speed factor. `0x00429680` separates a scripted body.
- `0x0042a100` (flag `0x8`, target tilt), `0x004464a0` (two point offsets) and `0x0042a290` (tilts and spins): differential-tested (`scripted-orientation.differential.spec.ts`, 1,500 cases, both precisions).
- `0x004a5750` `moveRouteFollower` is now complete (backward and crossing moves) and returns the displacement; differential spec updated.
- Two-point mode (flag `0x8`) is ported: `0x00448840` (target tilt from the turn radius over 4096), `0x004464a0`, `0x004465c0` (probes the midpoints of the front and rear wheel pairs, `+0x664..0x678`, instead of four wheels; landing has no air-time condition and bounces 1.3 times; each point on the ground carries half the weight) and the flag-8 wheel loop of `0x00445500`. Enter and leave: `0x00448660`, `0x00448730` (free body), `0x00429b40`, `0x00429bc0` (car body slots 12 and 13). The flip start `0x00429cf0` (scripted: rate, angle, pitch timer; free: `0x00445bb0`) is ported. The callers of the vtable slots are power-up effects (`0x0045cd70`, `0x004560b0`, `0x004573a0`), not wired here. `0x004465c0` is verified against the original with the segment query `0x00403fa0` replaced by a table-driven stub.

## Collision list

- A racer's list (rigid body `+0x140`, count `+0x154`, at most 5) holds the collision world and the checkpoint object; the STARTFIN instance (`+0x3b4`) is added for 150 ms when a trigger touches a racer (tagged positions, `0x0045e520` add, `0x0045e470` tick in chunks of at most 255 ms, `0x0045e3f0` remove). This is how lap progress, wrong-way and race positions work.
- Track effects (zone entered, target set, force changed, tagged position touched) are applied to racers in `changeTrackLogic`.

## collideRacers and the registry

- Pass 4 (`0x0043d180`): the real `createCollideRacers` runs racer against racer, then the registry sphere overlap tests (`0x0043d270`). Registry objects: main and environment triggers (fire `touchTrigger`), bricks (`0x00453af0`, collect), the power-up objects and the track hazards that registered in their Begin (`touchHazard`: ghost, lava, capture, rock, crane). Brick spheres have radius 0 (`0x004539b0`); extents are refreshed each frame.
- Bounding radius: the display figure's (racer `+0x5c`, the car builder's wheels figure) model bounds, `getFigureBounds(figures.wheels).radius`, the same value the original reads through `0x00411ca0`.

## Race end

- `0x0045b740`: a finishing racer's warp (`getStepWithRacerWarpsFinished`); human racers lose control.
- States 3 to 5 (`0x00434c80`, `0x00434eb0`, `0x00435180`): results hold 5 s when a points record exists; then `exit` = FINISHED and `race.ended` carries it.
- Points record (`race +0x18`): 30, 20, 10, 3, 2, 1 by place (`0x004b0b58`); `0x004402c0` record, `0x00440330` ticker (restarts at 400), `0x00440860` clear.
- Pause menu (`+0x30c0`): `0x00436010` enter, `0x00436160` resume, blink timer wraps at 500 ms; restart and quit ask for a confirmation. A demonstration ends at any key. `RaceExit`: NONE, FINISHED, QUIT, RESTART, LEFT, DEMONSTRATION_INTERRUPTED.
- **Hypotheses:** the in-place restart `0x004362e0` is exposed as `RaceExit.RESTART`; `+0x30a0 == 2` is set on confirm (its writer is unknown); `+0x7c4` is treated as 0.

## Headless runs

- Demonstration (`localPlayerCount: 0`, routes by `0x0043d070` nearest route): a 3-lap computer run shows checkpoint and lap progress and finish places 1 to 5; a full demonstration reaches RESULTS with exit FINISHED, 6 placed, identical on two runs (`run-headless-race.spec.ts`).

## Timed effect (the curse)

`0x00439900` (pass on: the receiver takes the giver's milliseconds left, charge 1000, racer flag `0x800`, driver flag `0x10`, vehicle reaction 2, car body held by `0x00429380`), `0x00439b00` (end: countdown 0, flags cleared, `0x004293c0`) and `0x004397b0` (car body slot `0x00429c30`) are ported with differential specs (figure, effect object and vehicle look stubbed out: presentation, not modelled). `0x00429330` (boost end, top speed = scale x 120) is ported with them; car body `+0x734` is not modelled. The boost start `0x004292e0` is not ported.

## Still open

`updateVehicle` (owned by the car builder), probe height (a constant bounds radius, not the current clip), emitters and sky, fades, sounds and force feedback (presentation, skipped).
