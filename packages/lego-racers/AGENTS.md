# AGENTS.md

## How this package works

Every rule is enforced by a check. When one fails, its output ends in a `Fix:` line: do that. Never weaken, skip or delete a check to get green. This package is part of a workspace: the full rule list is `.docs/rules.md` at the repository root, and the root `AGENTS.md` lists the other packages. Run the commands below inside this package's folder.

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
  modules/<context>/     one folder per bounded context (kebab-case, full words)
    index.ts             the ONLY file other code may import from this module
    <layer>/             see the table below
  shared/                used by several modules; never imports a module
    types/enum.types.ts  createEnum, used instead of `enum`
```

| Layer         | May import (besides itself and `src/shared`)         |
| ------------- | ---------------------------------------------------- |
| `types/`      | nothing — no packages                                |
| `events/`     | `types/`                                             |
| `services/`   | `types/`                                             |
| `controller/` | `types/`, `services/`, `events/`                     |
| `transport/`  | `controller/`, `types/`                              |
| `views/`      | `controller/`, `components/`, `providers/`, `types/` |
| `components/` | `controller/`, `providers/`, `types/`                |
| `providers/`  | `controller/`, `types/`                              |

### Conventions

- A file with a spec gets its own folder: `controller/create-note/create-note.ts` beside `create-note.spec.ts`.
- Types live in a sibling `<name>.types.ts`. Entities get branded ids: `type NoteId = string & { readonly __brand: 'NoteId' }`.
- Behaviour is built from functions that return objects. A class only `extends` something: an `Error`, or a base class a library requires.
- Value objects are created by factory functions that validate.
- Relative imports include the `.ts` extension.
- Every test is split into `// Arrange`, `// Act`, `// Assert`.

### Working style

1. **Spec first.** Copy `.docs/specs/_TEMPLATE.md` to `.docs/specs/<name>.md`; the gate fails until every section is real and every endpoint it declares exists.
2. **Exceptions need a reason:** `// eslint-disable-next-line <rule> -- reason` or `// @check-allow <check>: reason`. Prefer fixing the code.
3. **Same mistake twice?** Add a rule to `packages/tooling` (and `.docs/rules.md`) rather than fixing it a third time.
4. **Never** push to `main` or use `--no-verify`.

### Definition of done

1. `pnpm run ci` is green.
2. New behaviour has a co-located `*.spec.ts`.
3. The feature's spec is filled in.

## Package notes

- This is an exact port. Every behaviour traces back to an address in `LEGORacers.exe` or `GolDP.dll`; record it in `.docs/reverse-engineering/` at the repository root. Never write gameplay from guesses.
- Keep the race simulation free of DOM, rendering and timing APIs so a multiplayer server can run the same code in Node.
- Tests that need the original game files read them from `original-files/` at the repository root and skip when it is missing.
