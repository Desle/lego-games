# Feature: geometry

## Behaviour

Turns LDraw model text into a few drawable three.js objects, one way for every model: parsed in a worker, merged by material, baked for occlusion when the look needs it, made plastic and compiled once per look, detail, kind and text, and drawn as copies, in two details (plain studs far away, logo studs when the camera comes near).

## User flows

- **Set up the parser**: before the first model the app calls `setUpModelParser` with its library URL, a factory for its parse worker (a module worker whose script calls `listenForParseRequests`, optionally with a sub-model splitter), the splitter for the page-thread fallback, and its performance measuring.
- **Prepare a model**: `holdPreparedModel(text, detail, kind)` is the one prepare path. `PreparedModelKind.PART` is a plain model, `WHEEL` a wheel's plastic, `BODY` a body the app's splitter takes sub-models (its wheels) out of in the worker, those as wheel plastic. The hold's `prepared` is shared by every drawing of the same text; `release` lets go of it. A model nobody holds is kept for the next eight idle ones (a car leaving the garage for the race) and then freed; a hold never released keeps it for the page (the few parts every race draws).
- **Draw a model in two details**: `createDetailedModel(text, { materials, onInstance, onSubModels })` gives a `DetailSwitch` with the plain-stud copy first and the logo-stud copy when the camera comes near. Each copy (`instantiateModel`) shares the prepared geometry and the edge materials and takes the drawing's own copies of the plastic (`createMaterialSet`), so one drawing can fade (a ghost) alone. With `onSubModels` the model is a `BODY` and the callback gets copies of its sub-models for each detail. `release` lets go of the prepared models when the drawing goes.
- **Free a drawing**: `disposeObject` frees the geometries a drawing owns (never a prepared model's) and its meshes' materials once each.
- **Check an object**: `getIsMesh` and `getIsMaterial` are the type guards apps use.

## Invariants

- The page thread never parses for drawing when a worker is available; without one (or without a worker factory) the same work runs on the page.
- A model's buffers are moved from the worker, never copied.
- Two drawings of one text share the geometry; neither changes the other's materials.
- Asking for a model before `setUpModelParser` throws; nothing falls back to a hard-coded library URL.
- No game code: the only app hook into the worker is the sub-model splitter the app's own worker script passes.

## Out of scope

Where the library is served, which parts are wheels or figures (the app's splitter decides), the look of the plastic (the `material` module), and parsing a model unmerged (the `library` module's `parseLDrawModel`, for tools that look at parts one by one).
