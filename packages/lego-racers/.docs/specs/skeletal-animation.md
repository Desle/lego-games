# Feature: skeletal-animation

## Behaviour

Poses skeletons from animations exactly as the Gol engine's skeleton instance does (`GolDP.dll` vtable `0x10056fc8`): it samples each bone's position and rotation keys at a clip time, advances that time, blends two clips, builds the bone matrices the renderer selects with the draw commands' transforms, and moves an instance by its velocity. It uses no DOM or rendering library.

## User flows

- **Start an instance's animation**: `createSkeletonAnimationState` starts a clip at time 0, looping, at the clip's rate.
- **Advance it**: `advanceSkeletonAnimation` moves the clips by the elapsed integer milliseconds, wrapping or finishing them, handling the hand-over to a second clip and the blend between two.
- **Pose the skeleton**: `getSkeletonPose` takes the rest pose (`getRestPose`) and the state and gives each bone's rotation matrix and translation; `getBoneMatrices` multiplies each by its parent's, in file order.
- **Sample a track**: `samplePosition` and `sampleRotation` interpolate between the keys around a time, wrapping across the end of the clip.
- **Move the instance**: `getInstancePosition` adds the velocity times the elapsed milliseconds.

## Invariants

- Key times are unsigned 16-bit and shared by a bone's position and rotation tracks; with one key the key is returned, with none the bone keeps its pose.
- A time past the last key (or before the first) interpolates from the last key to the first across the clip length; a looping clip's time first loses whole multiples of its loop length.
- Quaternions blend linearly, through the negated second one when their dot product is not positive, and are normalised only when the rotation matrix is built (`2 / |q|²`).
- Matrices are row-major, row vectors multiply from the left, a bone's matrix is its own times its parent's, and every operation rounds to float32 in the order of the original's x87 code.
- A clip that does not loop stops on its last frame and is finished; one that continues with the second clip restarts looping from that clip's beginning.

## Out of scope

Starting a blend or the continuation (done by game code in the exe), the instance's mesh level selection by distance, the normal matrices (`0x10014b30`), the material scroll the same update advances, and the camera bounding sphere (`0x10023ef0`).
