# AGENTS.md

## How this repository works

This repository is a workspace: several packages, one gate. Every rule is enforced by a check. When one fails, its output ends in a `Fix:` line: do that. Never weaken, skip or delete a check to get green. The full rule list is `.docs/rules.md`.

### Packages

| Package                          | Folder                        | What it is                                                                                                             |
| -------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@lego-games/lego-racers`        | `packages/lego-racers`        | LEGO Racers (1999), ported exactly from `LEGORacers.exe` and `GolDP.dll`.                                              |
| `@lego-games/lego-racers-viewer` | `packages/lego-racers-viewer` | Browser track viewer (Vite, React, Three.js) rendering scenes from the player's own `LEGO.JAM`; `pnpm run dev:viewer`. |
| `@lego-games/tooling`            | `packages/tooling/`           | The rules as code: lint, TypeScript and Prettier config, the architecture checks, the git and Claude hooks.            |

Each package has its own `AGENTS.md` with its layout, commands and definition of done. Read it before changing code there, and run package commands inside its folder.

### Commands (at the repository root)

| When                        | Run                                                                   |
| --------------------------- | --------------------------------------------------------------------- |
| After every change          | `pnpm run check` (every package's check, plus the repository checks)  |
| Duplicate code              | `pnpm run duplicates` (part of `check`; move shared code, don't copy) |
| One package only            | `pnpm --filter <package> run check`                                   |
| Before you say you are done | `pnpm run ci`                                                         |

### Working style

1. **Code lives in a package.** Code used by several packages gets a package of its own and is imported by its name, never copied or reached through a relative path into another package.
2. **Exceptions need a reason:** `// eslint-disable-next-line <rule> -- reason` or `// @check-allow <check>: reason`. Prefer fixing the code.
3. **Same mistake twice?** Add a rule to `packages/tooling` (and `.docs/rules.md`) rather than fixing it a third time.
4. **Never** push to `main` or use `--no-verify`.

### Definition of done

1. `pnpm run ci` is green at the repository root.
2. Every changed package meets the definition of done in its own `AGENTS.md`.

## Repository notes

- `.docs/CONTEXT.md` explains the project; read it first.
- **Reverse engineering.** The ports are recovered from the original binaries, not imitated. Findings (addresses, structures, file layouts) live in `.docs/reverse-engineering/`. Ghidra headless scripts live in `reverse-engineering/scripts/`; the Ghidra project itself is in `reverse-engineering/ghidra/` and is gitignored.
- **Fast lookups.** `reverse-engineering/ghidra-server.sh start` keeps one Ghidra process open per binary (about 1 minute to start). Then `reverse-engineering/ghidra-query.sh <exe|dll> <command>` answers in under a second: `decompile <address…>`, `disassemble <start> <end>` (use this for float code), `xrefs <address>`, `bytes <address> <count>`, `strings <text>`, `function <address>`. Use the headless scripts only to change the project (create functions, apply names), then restart the servers so they pick it up.
- **Original game files** are copyrighted. They live in `original-files/` (gitignored) and are never committed, nor is raw decompiler output.
- **Differential tests.** Every ported function with an original address gets a `*.differential.spec.ts` beside it that runs the original in the emulator (`reverse-engineering/emulator/`, `.docs/reverse-engineering/emulator.md`) and compares bit for bit in both x87 precisions. `pnpm run differential` sets up the virtualenv and runs them; they skip without the original files.
