# Feature: bsp-tree

## Behaviour

Parses a `.BDB` BSP tree into plain, frozen data, reading it exactly as the Gol engine's BSP loader (`GolDP.dll` `0x1001ae50`) does: branch and leaf nodes, the root, and the two value sections.

## User flows

- **Parse a BSP tree**: the game passes the bytes of a `.BDB` file to `parseBspTree` and gets back `nodes`, `rootIndex`, `keyword2aEntries`, `keyword2bValues` and `readByteCount`.

## Invariants

- Negative node indices are stored as -1; a branch whose two children are both -1 is unsupported (error 17).
- The root is the last node with a negative parent, else node 0.
- A repeated section replaces the earlier one; the file is read to its end.

## Out of scope

Traversing the tree, and what the leaf values and the two value sections refer to.
