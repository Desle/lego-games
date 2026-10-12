# Rules

Every rule below is enforced by something that turns the build red, except the review-owned ones at the end. The checks live in `packages/tooling`; to change a rule, change the check there and this file together.

## Invariants

Mechanically decidable; a green check is a proof.

### Strict types, no `any`

- **Rule**: Strict mode, no `any`, no unchecked index access, no `any` flowing through assignments.
- **Why**: `any` is the hole through which generated code becomes silently unsafe.
- **Enforced by**: TypeScript `strict` · TypeScript `noUncheckedIndexedAccess` · TypeScript `exactOptionalPropertyTypes` · ESLint `@typescript-eslint/no-explicit-any` · ESLint `@typescript-eslint/no-unsafe-assignment`

### Only erasable TypeScript syntax

- **Rule**: No `enum`, `namespace` or constructor parameter properties; type-only imports use `import type`. Use `createEnum` instead of `enum`.
- **Why**: Node runs the TypeScript directly by stripping the types, which only works for erasable syntax.
- **Enforced by**: TypeScript `erasableSyntaxOnly` · TypeScript `verbatimModuleSyntax` · ESLint `no-restricted-syntax`

### No floating promises

- **Rule**: Every promise is awaited, returned or explicitly voided.
- **Why**: A forgotten `await` is the most common silent bug in generated async code.
- **Enforced by**: ESLint `@typescript-eslint/no-floating-promises`

### What typechecks also builds

- **Rule**: The gate runs the production build, not just the typecheck.
- **Why**: Typecheck-only gates let module-resolution mistakes through to the first deploy.
- **Enforced by**: `pnpm run build`

### Nothing under the source directory goes unchecked

- **Rule**: Every file under the source directory is parsed by the architecture checks, typechecked and linted, unless its extension is declared non-source.
- **Why**: A new file type (`.tsx`, `.vue`) that no tool reads ships a vacuously green gate.
- **Enforced by**: `tooling verify` → `source-coverage`

### The gate cannot be unplugged

- **Rule**: The `ci` script runs every gate step, a CI workflow runs `pnpm run ci` and gitleaks, the git and Claude Code hooks run the tooling, and CLAUDE.md imports AGENTS.md. In a workspace, the root `check` and `ci` run those of every package, and every package keeps its own gate and brief.
- **Why**: An agent under pressure will delete the check that blocks it; this makes that a failure too.
- **Enforced by**: `tooling verify` → `gate-wiring`

### Feature specs match the code

- **Rule**: Every module in `src/modules/` has a spec named after it, every spec has its required sections filled in, and every endpoint a spec declares is registered in code.
- **Why**: The spec is what agents code against; a spec that drifts from the code misleads them.
- **Enforced by**: `tooling verify` → `feature-specs`

### No duplicated code

- **Rule**: No block of 50 or more tokens appears twice in non-test TypeScript, anywhere in `packages/`. When two places need the same code, it moves to the module that owns the concept (shared through its `index.ts`) or to `src/shared/`.
- **Why**: Agents working in parallel port similar original routines independently; without a check, the same reader or helper ends up in several modules and drifts apart.
- **Enforced by**: `pnpm run duplicates` (jscpd, `.jscpd.json`, threshold 0) in the root `check` and `ci`
- **Exception**: when the original binary itself contains two copies that must stay separately traceable, wrap one in `// jscpd:ignore-start` … `// jscpd:ignore-end` with a comment naming both addresses.

### No committed symlinks

- **Rule**: No symlink is committed. Local links (`original-files`, the emulator's `.venv`) stay untracked, and their `.gitignore` entries have no trailing slash so they match a link as well as a folder.
- **Why**: A committed link replaces the real folder it shadows on every checkout; it twice wiped the local original game files.
- **Enforced by**: `tooling verify` → `tracked-symlinks` (workspace root)

### Uniform formatting

- **Rule**: Prettier formats every file.
- **Why**: Formatting noise hides real changes in review.
- **Enforced by**: `pnpm run format:check`

### No committed secrets, no known-vulnerable dependencies

- **Rule**: No secret matching gitleaks patterns is committed; no high or critical advisory is installed.
- **Why**: Agents paste keys they saw in context. gitleaks catches known secret shapes, not every secret.
- **Enforced by**: CI `gitleaks detect` · `pnpm run audit:high`

### Never push to a protected branch

- **Rule**: Work happens on a branch; `main` changes only through a pull request with a green gate.
- **Why**: The gate is only a boundary if nothing bypasses it.
- **Enforced by**: git `pre-push` hook

## Policy

Team conventions, enforced mechanically; tunable per package in `tooling.config.ts`.

### Module and layer boundaries

- **Rule**: Code lives in `src/modules/<context>/<layer>/`. Other code imports a module only through its `index.ts`. Layers point inward (see the table in AGENTS.md). `types/` imports no packages. `src/shared` never imports modules.
- **Why**: An agent's default is to import whatever is closest; boundaries keep contexts replaceable.
- **Enforced by**: `tooling verify` → `layer-boundaries`
- **Exception**: `// @check-allow layer-boundaries: <reason>`

### Types live in `.types.ts` files

- **Rule**: `type` declarations, and object types like `{ id: string }` in parameters or casts, belong in a sibling `<name>.types.ts` file, never inline in implementation files.
- **Why**: Types are a module's contract; isolating them keeps the contract importable without behaviour.
- **Enforced by**: `tooling verify` → `types-in-types-files` · ESLint `@typescript-eslint/consistent-type-definitions`
- **Exception**: `// @check-allow types-in-types-files: <reason>`

### No abbreviations

- **Rule**: Identifiers are full words: `request` not `req`, `error` not `err`/`e`, `index` not `i`. A stop-list catches the common ones; review owns the rest.
- **Why**: Abbreviations save keystrokes once and cost every reader a lookup.
- **Enforced by**: ESLint `@typescript-eslint/naming-convention`

### Arrow functions only

- **Rule**: `const name = () => …`; no `function` declarations or expressions (methods and constructors inside an allowed class are fine). One-expression bodies omit braces (`() => doThing()`), except assignments and test blocks (`describe`, `it`, `beforeEach`, …).
- **Why**: One function form across every codebase.
- **Enforced by**: ESLint `no-restricted-syntax` · ESLint `arrow-body-style`

### Classes only to extend something

- **Rule**: Build behaviour from functions that return objects. A class is allowed only when it `extends` something: an `Error` subclass, or a base class a library requires.
- **Why**: Methods passed as callbacks lose `this`, and one construction style keeps code uniform; errors and framework base classes are what a function cannot replace.
- **Enforced by**: ESLint `no-restricted-syntax`

### No mutated parameters

- **Rule**: No reassigning or mutating parameters, `readonly` class fields.
- **Why**: A function that changes what it was given makes data flow hard to trace.
- **Enforced by**: ESLint `no-param-reassign` · ESLint `@typescript-eslint/prefer-readonly`

### Booleans start with `is`

- **Rule**: Boolean variables, parameters and properties are named `isSomething`. Names taken from someone else (destructuring, object literals) are exempt; a type that mirrors an external API keeps its field names with a whole-file `eslint-disable … -- reason`.
- **Why**: The name alone tells the reader the type.
- **Enforced by**: ESLint `@typescript-eslint/naming-convention`

### Configuration comes from one place

- **Rule**: Only the environment module reads `process.env`; everything else receives validated values.
- **Why**: A missing variable fails at startup, not on the first request that needs it.
- **Enforced by**: ESLint `no-restricted-properties`

### Every exception says why

- **Rule**: `eslint-disable` comments carry `-- reason` and unused ones are errors; check exceptions use `// @check-allow <check>: reason`.
- **Why**: An unexplained exception is indistinguishable from a mistake.
- **Enforced by**: ESLint `@eslint-community/eslint-comments/require-description` · ESLint `@eslint-community/eslint-comments/no-unlimited-disable`

### No stale TODOs

- **Rule**: A `TODO` or `FIXME` line older than `maximumTodoAgeInDays` (default 90) fails, dated per line.
- **Why**: Catches abandoned half-finished work.
- **Enforced by**: `tooling verify` → `stale-todos`

### Behaviour constants trace to the binary

- **Rule**: In `packages/lego-racers/src/modules/**` (non-test), a numeric literal is either the initialiser of a named `const` with an original address (`0x00xxxxxx` or `0x10xxxxxx`) in a comment on the same line or alone on the line above, a structural value (`0`, `1`, `-1`, `2`; hex byte masks `0xff`/`0xffff`/`0xffffff`/`0xffffffff`; shift counts 8/16/24/32; array indices; type positions), or marked `// @check-allow traced-constants: reason`. A `createEnum` map gets no exemption: its values are binary codes and need addresses. `traced-constants-baseline.json` lists the literals that predate the rule, keyed by file, enclosing names and literal text (not line); it may only shrink: new literals fail, and so does slack, so run `pnpm run traced-constants:baseline` after tracing some. Renaming a scope means editing its baseline keys by hand, in review.
- **Why**: A divergence from the original is fixed by finding the original value, never by tuning a number.
- **Enforced by**: `tooling verify` → `traced-constants` (workspace root)

## Owned by review

Not mechanically decidable; reviewers and agents uphold these.

### Function names say what they do

- **Rule**: `get…` returns a value, `getIs…` a boolean, `set…` updates one value, `on…` handles an event and only delegates, HTTP functions start with their method (`getUser`, `postOrder`).
- **Why**: A reader should not need the body to know what a call does.
- **Enforced by**: code review (not mechanically decidable)

### Ubiquitous language

- **Rule**: Names match the business terms in `.docs/CONTEXT.md` and the specs exactly.
- **Why**: Code that speaks the domain language needs no translation layer in anyone’s head.
- **Enforced by**: code review (not mechanically decidable)
