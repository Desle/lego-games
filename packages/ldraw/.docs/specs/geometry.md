# Feature: geometry

## Behaviour

Turns LDraw model text into a few drawable three.js objects: parsed in a worker, merged by material, baked for occlusion when the look needs it, prepared once per text and detail, and drawn in two details (plain studs far away, logo studs when the camera comes near).

## User flows

- **Set up the parser**: before the first model the app calls `setUpModelParser` with its library URL, a factory for its parse worker (a module worker whose script calls `listenForParseRequests`, optionally with a sub-model splitter), the splitter for the page-thread fallback, and its performance measuring.
- **Draw a shared part**: `createDetailedPart(text, materials, onInstance)` gives a `DetailSwitch` that shows the plain-stud model first and builds the logo-stud model when the camera comes near. The prepared model is made once per text and detail (`getPreparedModel`) and copied with `instantiateModel`, the meshes taking the drawing's own copies of the materials (`createMaterialSet`).
- **Draw a vehicle body**: `createDetailedBody(text, onSubModels)` parses a body that is not shared; the app's splitter takes its sub-models (the wheels) out in the worker, and `onSubModels` gets them as wheel plastic for each detail.
- **Free a drawing**: `disposeObject` frees the geometries of an object's meshes and each of their materials once.

## Invariants

- The page thread never parses when a worker is available; without one (or without a worker factory) the same work runs on the page.
- A model's buffers are moved from the worker, never copied.
- Asking for a model before `setUpModelParser` throws; nothing falls back to a hard-coded library URL.
- No game code: the only app hook into the worker is the sub-model splitter the app's own worker script passes.

## Out of scope

Where the library is served, which parts are wheels or figures (the app's splitter decides), and the look of the plastic (the `material` module).
