# AGENTS.md

## How this package works

Generic LDraw for every LEGO game port in this repository: the parts library, parsing and merging models in a worker, the plastic looks, and the maths of building on the stud grid. It knows no game. An app (today `@lego-games/lego-racers-web`) serves the library, passes its URL in, and adds anything game-specific through the hooks below. Stack: TypeScript and three.js (`three/examples` `LDrawLoader`), run in the browser through the app's Vite build.

Every rule is enforced by a check. When one fails, its output ends in a `Fix:` line: do that. Never weaken, skip or delete a check to get green. The full rule list is `.docs/rules.md` at the repository root. Run the commands below inside this package's folder.

### Commands

| When                         | Run                                                            |
| ---------------------------- | -------------------------------------------------------------- |
| After every change           | `pnpm run check` (typecheck, lint, architecture checks, tests) |
| One test file                | `pnpm run test <path>`                                         |
| Before you say you are done  | `pnpm run ci` (check + formatting + build + audit)             |
| Auto-fix formatting and lint | `pnpm run format`                                              |

### Where code goes

```
src/
  modules/
    library/    where parts come from: the loader against the app's library URL, LDConfig colours, plain or logo studs
    geometry/   parse in a worker, merge by material, the two details, the prepared-model cache and its copies
    material/   plastic, the look presets (shadings, edges), occlusion bake, shader precompile
    building/   pure stud-grid maths: documents, rotation, part shapes, placement, editing, history
    minifig/    where the library's minifigure parts sit, assembled
    files/      node only, for an app's dev server: the routes that serve the library and a models folder, list parts, save models
  shared/types/enum.types.ts   createEnum, used instead of `enum`
```

Each module is imported only through its `index.ts`, by apps as `@lego-games/ldraw/<module>` (the `exports` of `package.json`). `files` uses `node:` modules: only an app's Vite config and node scripts import it, never browser code. The index exports what apps use: that is the module's public API, so keep it small and add to it on purpose. The layer table is the one in `packages/lego-racers/AGENTS.md`; types that name three.js types sit beside their code in `services/`, since `types/` imports no package.

### Conventions

- **No game code.** Never import `@lego-games/lego-racers*` or reach into another package by a relative path (`tooling.config.ts` `forbiddenImports`, the `layer-boundaries` check). A game-specific step comes in from the app as a parameter or setting: the library URL, the parse worker's sub-model splitter, the performance measurer, the shader precompiler.
- **LDraw units and axes** everywhere: a stud is 20 wide, a plate 8 high, a brick 24; y points down. Convert to a game's units in the app.
- A file with a spec gets its own folder: `services/builder-studs/builder-studs.ts` beside `builder-studs.spec.ts`. Types live in a sibling `<name>.types.ts`.
- Arrow functions, full words, `createEnum` instead of `enum`. A class only `extends` something (`DetailSwitch extends Object3D`).
- Relative imports include the `.ts` extension.
- Every test is split into `// Arrange`, `// Act`, `// Assert`.

### Definition of done

1. `pnpm run ci` is green.
2. New behaviour has a co-located `*.spec.ts`.
3. The module's spec (`.docs/specs/<module>.md`) is filled in.
4. A change to what an app draws also passes that app's checks (for LEGO Racers: `pnpm run hd-coverage` and the pixel trace at the root).
