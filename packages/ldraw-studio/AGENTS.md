# AGENTS.md

## How this package works

The LDraw studio: the development app of the LDraw editor, for every LEGO game port. It serves the LDraw parts library and the local models folder, lets you pick a model, and shows it in the editor tools that `@lego-games/ldraw` exports (`@lego-games/ldraw/editor`). It also exports the dev server's LDraw file routes (`@lego-games/ldraw-studio/files`), which a game's dev server mounts too (LEGO Racers' `vite.config.ts`). Stack: Vite, plain TypeScript DOM (no React), three.js through the library.

Every rule is enforced by a check. When one fails, its output ends in a `Fix:` line: do that. Never weaken, skip or delete a check to get green. The full rule list is `.docs/rules.md` at the repository root. Run the commands below inside this package's folder.

### Commands

| When                         | Run                                                                    |
| ---------------------------- | ---------------------------------------------------------------------- |
| Develop                      | `pnpm run dev` (also `pnpm studio` at the root): http://localhost:5200 |
| After every change           | `pnpm run check` (typecheck, lint, architecture checks, tests)         |
| Before you say you are done  | `pnpm run ci` (check + formatting + build + audit)                     |
| Auto-fix formatting and lint | `pnpm run format`                                                      |

The dev server reads the library from `LEGO_LDRAW_ROOT` (default `~/ldraw`) and the models folder from `LEGO_LDRAW_MODELS_ROOT` (default `~/ldraw-models`), the same variables as the LEGO Racers dev server. Port 5200 is strict; `pnpm run dev --port <other>` runs a second one.

### Where code goes

```
src/
  main.ts       composition root: mounts the studio in index.html's #studio
  modules/
    studio/     the page: tabs (Models for now), the model picker over files.json, reading a model with the model files it places
    files/      node only, for any dev server: the routes that serve the library and a models folder, list parts, save models
  shared/types/enum.types.ts   createEnum, used instead of `enum`
```

`files` uses `node:` modules: only a Vite config, node scripts and specs import it, never browser code. The editor UI itself (viewer, later builder and minifigure poser) belongs in `@lego-games/ldraw/editor`, so a game can embed it; the studio only feeds it files.

### Conventions

- **No game code.** Never import `@lego-games/lego-racers*` or reach into another package by a relative path (`tooling.config.ts` `forbiddenImports`, the `layer-boundaries` check).
- A file with a spec gets its own folder; types live in a sibling `<name>.types.ts`.
- Arrow functions, full words, `createEnum` instead of `enum`. Relative imports include the `.ts` extension.
- Every test is split into `// Arrange`, `// Act`, `// Assert`.

### Definition of done

1. `pnpm run ci` is green.
2. New behaviour has a co-located `*.spec.ts`.
3. The module's spec (`.docs/specs/<module>.md`) is filled in.
4. A change to `files` also passes LEGO Racers' checks (it mounts the same routes).
