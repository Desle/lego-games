# Feature: checkpoint

## Behaviour

Parses a race's `.CPB` checkpoint file exactly as `Checkpoints_Load` (`LEGORacers.exe` `0x0041e770`) does, then assigns each checkpoint its progress along the track as `0x0041e950` does: evenly from 0 to 1 around the loop of next links from checkpoint 0, then evenly along each branch between where it leaves and where it rejoins.

## User flows

- **Parse checkpoints**: the race passes the bytes of `RACE.CPB` and its mirror flag to `parseCheckpoints` and gets every checkpoint's plane, point, four links and progress, and `readByteCount`.
- **Assign progress**: `assignCheckpointProgress(links)` returns the progress values alone, for a caller that builds checkpoints another way.

## Invariants

- The file is `0x27 [ count ] { (0x27 { keywords }) * count }`; nothing after the closing curly is read. More than 254 checkpoints throws `TooManyCheckpointsError`, as the original's fatal "Too many CheckPoints".
- Keywords are `0x28` plane (4 floats), `0x29` links (4 integers stored as bytes) and `0x2a` point (3 floats); any other is a syntax error. Absent ones keep the reset values of `0x0041e600` (zeros, links 255).
- A mirrored track negates the plane's and the point's y component.
- Progress values are float32 stores of sums kept at double precision, as the x87 code keeps them in a register between stores. A checkpoint no walk reaches keeps -1.
- An empty file, a link outside the array, or a walk that never ends throws `UnportableCheckpointsError`, where the original would read invalid memory or hang.

## Out of scope

Using the planes to detect a racer crossing a checkpoint, and the collision world's checkpoint object named by the race description.
