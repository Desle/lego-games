# Feature: library

## Behaviour

Reads LDraw models with three.js's `LDrawLoader` against an LDraw parts library the app serves at a URL it chooses (the folder of the official `complete.zip` that holds `LDConfig.ldr`, `parts/` and `p/`), with the library's colours, and chooses which stud file a model is built with: the plain `stud.dat` or one of the LEGO-logo variants.

## User flows

- **Parse a model**: the app passes a model's text, its library URL and an `LDrawDetail` to `parseLDrawModel` and gets back the loader's three.js group. One loader per library and detail keeps every part it has read, so a part is fetched and built once.
- **Choose the studs**: `LDrawDetail.HIGH` builds studs with the logo (level 4, rounded 3D, by default), `LDrawDetail.LOW` with plain studs. `setIsStudLogoShown(false)` (from `?studlogos=0`, read by `getIsStudLogoRequested`) makes `getModelDetail` build every model plain.

## Invariants

- The library is never bundled or uploaded: only the parts a model names are fetched from the app's URL.
- Nothing here knows a game: no route, file or name of any LEGO game is hard-coded.

## Out of scope

Serving the library (the app's dev server does), merging and caching models (the `geometry` module) and how they look (the `material` module).
