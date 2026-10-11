# Feature: world-animation

## Behaviour

Keeps the animated state of a race's worlds and advances it as the exe's world update `0x00416090` does: skeleton instances play their clips and move by the clip's velocity, material animation entries that instances refer to play looping, and mesh instances hold their position and level distances. Hazards and the track logic read and change this state; the viewer draws it. It uses no DOM or rendering library.

## User flows

- **Create a world's animation**: `createWorldAnimation` links a parsed world with its animations and material animations the way `World_LinkInstances` (`GolDP.dll` `0x1002e640`) does: each skeleton instance starts the clip its `0x35` keyword names, each referenced material animation entry starts looping.
- **Advance it**: `advanceWorldAnimation(world, milliseconds)` advances the material animations, then the skeleton instances.
- **Read and write an instance**: `getSkeletonInstanceFlags` and `getSkeletonInstanceTime` give the instance's flag word (`+0x5c`) and clip time (`+0xb4` or `+0xd0`); `getSkeletonInstanceWithFlags`, `startSkeletonInstanceClip` and the material playback functions change them like the exe's `0x0040dae0`, `0x00410430`, `0x00410470`, `0x00410480` and `0x00410490`.

## Invariants

- An instance whose animated flag (`0x10000`) is clear never advances its clip, but still moves by its velocity.
- A material animation entry advances only while playing; one that does not loop stops and rewinds when its time reaches its length.
- The flag word of a skeleton instance is a view of its animation state: writing it back changes the state's booleans.
- Every operation rounds to float32 in the order of the original's x87 code.

## Out of scope

Mesh instances' material scrolling (`0x10027f40`'s offsets), sprites (`0x004047b0`), BSP volumes, and drawing.
