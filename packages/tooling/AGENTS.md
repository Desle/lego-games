# AGENTS.md

## How this package works

This package is the repository's rules as code. Every other package uses its ESLint config
(`@lego-games/tooling/eslint`, with `environment: 'browser'` in browser packages), TypeScript config
(`@lego-games/tooling/tsconfig/node`, or `@lego-games/tooling/tsconfig/bundler` for Vite packages) and
Prettier config, and runs its `tooling verify` checks. The git `pre-push` hook and the Claude Code hooks
run `tooling hook …`. `.docs/rules.md` at the repository root lists every rule and what enforces it.

### Commands

| When                        | Run                                                            |
| --------------------------- | -------------------------------------------------------------- |
| After every change          | `pnpm run check` (typecheck, lint, architecture checks, tests) |
| Before you say you are done | `pnpm run ci` (check + formatting + build + audit)             |

### Layout

```
src/
  cli/main.ts      the `tooling` command: `verify`, `hook <post-edit|stop|pre-push>`
  checks/          one folder per architecture check, registered in check-registry.ts
  hooks/           the git pre-push hook and the Claude Code post-edit and stop hooks
  eslint/          the shared ESLint config
  config/          tooling.config.ts loading and the defaults
  project/         reading files, git, the TypeScript project and the workspace
configs/           the shared tsconfig and Prettier config
tests/fixtures/    a sample workspace the CLI tests run against
```

### Changing a rule

1. Change the check (or the ESLint config) and its tests.
2. Update `.docs/rules.md` in the same change.
3. Run `pnpm run ci` at the repository root: every package must still pass, or be fixed in the
   same pull request.

### Working style

1. **Exceptions need a reason:** `// eslint-disable-next-line <rule> -- reason` or `// @check-allow <check>: reason`. Prefer fixing the code.
2. **Never** push to `main` or use `--no-verify`.

### Definition of done

1. `pnpm run ci` is green at the repository root.
2. New behaviour has a co-located `*.spec.ts`.
