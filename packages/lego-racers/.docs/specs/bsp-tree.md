# Feature: bsp-tree

## Behaviour

Parses a `.BDB` BSP tree into plain, frozen data, reading it exactly as the Gol engine's BSP loader (`GolDP.dll` `0x1001ae50`) does: branch and leaf nodes, the root, and the two value sections. It also says which leaves the engine draws for a camera (`0x1001b2c0`, `0x1001b640`, `0x1002bc90`).

## User flows

- **Choose the leaves to draw**: the renderer passes a tree and the camera (its position and six frustum planes) to `getVisibleBspLeaves` and gets the leaf holding the camera, then the leaves of its visibility list whose bounding volume the frustum does not reject, each with the run of draw commands it covers and whether it needs clipping.
- **Parse a BSP tree**: the game passes the bytes of a `.BDB` file to `parseBspTree` and gets back `nodes`, `rootIndex`, `keyword2aEntries`, `keyword2bValues` and `readByteCount`.

## Invariants

- Negative node indices are stored as -1; a branch whose two children are both -1 is unsupported (error 17).
- The root is the last node with a negative parent, else node 0.
- A repeated section replaces the earlier one; the file is read to its end.

- The camera's leaf is always drawn and always clipped; a listed leaf without a volume is drawn clipped; a volume with every corner behind one plane hides its leaf, one with a corner behind a plane draws it clipped, and one fully inside draws it unclipped.
- Float sums follow the engine's order and precision (`volume-visibility.differential.spec.ts` compares `0x1002bc90` with the original).

## Out of scope

The stackless tree walk of `0x1001b2c0` for a tree without a visibility list (no race file lacks one), and the clipping itself.
