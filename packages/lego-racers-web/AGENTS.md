# AGENTS.md

## How this package works

The LEGO Racers game in the browser (with a developer track viewer): the player opens their own `LEGO.JAM` (read in the browser, never uploaded), picks a world, and sees it rendered with Three.js. The scene comes fully resolved from `@lego-games/lego-racers/scene`; this package only turns it into Three.js objects. Stack: Vite, React 19, TypeScript, Tailwind CSS v4, Three.js.

Every rule is enforced by a check. When one fails, its output ends in a `Fix:` line: do that. Never weaken, skip or delete a check to get green. The full rule list is `.docs/rules.md` at the repository root. Run the commands below inside this package's folder.

### Commands

| When                         | Run                                                            |
| ---------------------------- | -------------------------------------------------------------- |
| Develop                      | `pnpm run dev` (also at the root)                              |
| After every change           | `pnpm run check` (typecheck, lint, architecture checks, tests) |
| Before you say you are done  | `pnpm run ci` (check + formatting + build + audit)             |
| Auto-fix formatting and lint | `pnpm run format`                                              |

In development the page opens the game by itself when the dev server serves the files, and the backquote key opens the developer overlay (track viewer, power-up keys 1 to 6, stop the race), lazily loaded and compiled out of production (`import.meta.env.DEV`). The track viewer has a **Load the development LEGO.JAM** button: the dev server (`vite.config.ts`, `apply: 'serve'`) serves `original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM`, or `LEGO_JAM_PATH`, at `/__development/lego.jam`. The route does not exist in a production build and the button is compiled out of it.

In development the race mode also uses `/__development/game-files/<name>`, which serves `LEGORacers.exe` and the `.tun` files next to the JAM (same plugin rules).

### Where code goes

```
src/
  main.tsx               composition root
  modules/track-viewer/
    index.ts             the ONLY file other code may import from this module
    types/               viewer state and catalogue types (no packages)
    services/            Three.js scene building and viewport, JAM file reading, world catalogue
    controller/          React hooks that orchestrate state and the viewport
    providers/           the viewer context
    components/          presentational pieces (props only, snapshot-tested)
    views/               the page
  modules/remastered/    the optional `?hd` layer (textures, widescreen), development only; see .docs/remastered.md
  shared/                createEnum, the development route, the viewer extension points
```

The layer table is the one in the root `.docs/rules.md` and `packages/lego-racers/AGENTS.md`.

### Conventions

- Arrow functions, full words, types in sibling `.types.ts` files, `createEnum` instead of `enum`.
- Every component has a co-located `*.spec.tsx` with snapshot tests of its states.
- Rendering follows the original renderer: material state from `GolDP.dll` `0x1000a2c0`, no colour management, front faces only (`0x1000ebd0`). Approximations are commented where they are made.
- Every test is split into `// Arrange`, `// Act`, `// Assert`.

### Definition of done

1. `pnpm run ci` is green.
2. New behaviour has a co-located spec.
3. The feature's spec (`.docs/specs/track-viewer.md`) is filled in.
