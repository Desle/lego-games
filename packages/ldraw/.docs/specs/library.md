# Feature: library

## Behaviour

Reads LDraw models with three.js's `LDrawLoader` against an LDraw parts library the app serves at a URL it chooses (the folder of the official `complete.zip` that holds `LDConfig.ldr`, `parts/` and `p/`), with the library's colours, and chooses which stud file a model is built with: the plain `stud.dat` or one of the LEGO-logo variants.

## User flows

- **Parse a model unmerged**: `parseLDrawModel(text, libraryUrl, detail)` gives the loader's three.js group, one object per part line with the loader's `userData`, on the calling thread. It is the parse worker's step and the one way for a tool that needs the parts one by one (a coverage check); drawings go through the geometry module's `holdPreparedModel`. One loader per library and detail keeps every part it has read, so a part is fetched and built once.
- **Choose the studs**: `LDrawDetail.HIGH` builds studs with the logo (level 4, rounded 3D, by default), `LDrawDetail.LOW` with plain studs. Logos are off by default: `getModelDetail` builds every model plain unless the app calls `setIsStudLogoShown(true)` once, before the first model.

## Invariants

- The library is never bundled or uploaded: only the parts a model names are fetched from the app's URL.
- Nothing here knows a game: no route, file or name of any LEGO game is hard-coded.

## Out of scope

Serving the library (the app's dev server does), merging and caching models (the `geometry` module) and how they look (the `material` module).
