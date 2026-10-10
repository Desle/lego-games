# Feature: skeleton

## Behaviour

Parses a `.SDB` skeleton into plain, frozen data, reading it exactly as the Gol engine's skeleton loader (`GolDP.dll` `0x10029a20`) does: named bones with their position, quaternion and parent.

## User flows

- **Parse a skeleton**: the game passes the bytes of a `.SDB` file to `parseSkeleton` and gets back `bones`, in file order, and `readByteCount`.

## Invariants

- A parent is found among the bones named so far, the bone itself included; an unknown parent is an invalid string.
- Names are at most eight characters and a repeated name is fatal.
- A later `0x27` block replaces the bones of an earlier one.
- A bone the file ends inside makes the original loop forever; the port refuses it.

## Out of scope

Building bone matrices (`0x10002e30`) and posing skeletons.
