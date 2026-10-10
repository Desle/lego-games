# Feature: start-position

## Behaviour

Parses a race's `.SPB` start positions exactly as `RacerSet_LoadStartPositions` (`LEGORacers.exe` `0x0043bc10`) does: for each block, the racer slot it fills, the position and the two axis vectors.

## User flows

- **Parse start positions**: the race passes the bytes of `STARTPOS.SPB` and its mirror flag to `parseStartPositions` and gets the blocks in file order and `readByteCount`; the racer set writes each block's vectors into its slot.

## Invariants

- The file is `0x27 [ count ] { (0x27 slot { keywords }) * count }`; nothing after the closing curly is read.
- Keywords are `0x28` position (3 floats) and `0x29` two axis vectors (6 floats); any other is a syntax error. A vector the block does not name is `null`, because the original leaves that slot's value as it was.
- The slot is not range-checked, as in the original.
- A mirrored track negates the y component of every vector.

## Out of scope

Placing the racers on the grid from these slots, which belongs to the racer set.
