# Feature: model

## Behaviour

Parses a `.GDB` model file into plain, frozen data, reading it exactly as the Gol engine's model loader (`GolDP.dll` `0x100270e0`) does: the names of the materials it uses, its vertex buffer, its triangle faces, its packed draw commands and its scale.

## User flows

- **Parse a model**: the game passes the bytes of a `.GDB` file to `parseModel` and gets back a `Model`: `materialNames`, `vertexBuffer` (one of three vertex formats), `positionVertexBuffer`, `faces`, `commands`, `scale` and `readByteCount`.
- **Draw a model**: the renderer walks `commands` in order: `select_material` picks an entry of `materialNames`, `select_transform` picks a transform, `transform_vertices` loads vertices into the 64-entry vertex cache, and `draw_faces` draws faces whose indices point into that cache.

## Invariants

- Keywords are read until the end of the file; an unknown keyword is a syntax error and a second section of the same kind is an unexpected keyword, as in the original.
- Material names keep only their first eight characters, as `0x10025f90` copies them.
- Vertex counts keep their low 16 bits, face indices their low 8 bits, as the original stores them.
- A command list is packed exactly as `0x10027430` packs it, including transform commands overwriting each other until the next material, vertex or face command.
- Input whose original outcome depends on uninitialised memory throws `UnportableModelError`.

## Out of scope

Resolving material names against a material library, computing the bounding sphere (`0x100278c0`), and rendering.
