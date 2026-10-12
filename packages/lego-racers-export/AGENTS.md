# AGENTS.md

## How this package works

A command-line tool: `pnpm run export-assets -- --game "<Game Files dir>" --out <dir>` (at the repository root) reads the player's own game files and writes every texture (PNG), sound and music track (WAV), video (PNG frames, WAV, lossless mkv) and model (glTF 2.0) to a folder outside the repository, with a `manifest.json`. The decoding is done by `@lego-games/lego-racers` (`jam-archive`, `bitmap`, `targa`, `audio`, `scene`, `skeleton`, `animation`, `skeletal-animation`); this package only converts and writes. Exported data is copyrighted: never commit it.

Every rule is enforced by a check. When one fails, its output ends in a `Fix:` line: do that. Never weaken, skip or delete a check to get green. The full rule list is `.docs/rules.md` at the repository root. Run the commands below inside this package's folder.

### Commands

| When                         | Run                                                            |
| ---------------------------- | -------------------------------------------------------------- |
| After every change           | `pnpm run check` (typecheck, lint, architecture checks, tests) |
| Before you say you are done  | `pnpm run ci` (check + formatting + build + audit)             |
| Auto-fix formatting and lint | `pnpm run format`                                              |

### Where code goes

```
src/modules/asset-export/
  types/        export entries and glTF document types, no packages
  services/     encoders (PNG, WAV, glTF), the Windows BMP decoder, the output writer, ffmpeg
  controller/   one exporter per asset type, the orchestrator and the command
```

The layer table is the one in `packages/lego-racers/AGENTS.md`.

### Conventions

- Arrow functions, full words, types in sibling `.types.ts` files, `createEnum` instead of `enum`.
- Models are written in the engine's Z-up frame under a root node that rotates it to glTF's Y-up; texture V is flipped (the engine's v = 0 is the picture's bottom edge).
- Every test is split into `// Arrange`, `// Act`, `// Assert`.

### Definition of done

1. `pnpm run ci` is green.
2. New behaviour has a co-located `*.spec.ts`.
