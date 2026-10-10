# typescript-starter

Template for any TypeScript project (service, library, CLI or frontend) built on
[`@desle/typescript-foundation`](https://github.com/Desle/typescript-foundation). The rules,
checks, lint/type/format configs, agent hooks and CI live in that package, so improvements
reach every project through the weekly dependency-update pull request.

## Start a project

```sh
gh repo create my-project --private --template Desle/typescript-starter --clone
cd my-project
pnpm install                # also points git at .git-hooks/
pnpm run setup my-project   # renames, removes the notes example, allows the weekly update PR
pnpm run ci
```

Needs Node 24 (`.nvmrc`) and pnpm (`corepack enable`).

## Daily use

| Command                      | What it does                                               |
| ---------------------------- | ---------------------------------------------------------- |
| `pnpm run dev`               | Run `src/main.ts` with reload; reads `.env` if present     |
| `pnpm run check`             | Typecheck, lint, architecture checks, tests: the fast loop |
| `pnpm run ci`                | The full gate CI runs; also runs on `git push`             |
| `pnpm run new:module <name>` | Scaffold `src/modules/<name>` and its spec                 |
| `pnpm run sync`              | Regenerate the foundation-managed docs                     |
| `pnpm run format`            | ESLint auto-fix, then Prettier                             |

`AGENTS.md` is the brief for AI agents (`CLAUDE.md` imports it). `.docs/foundation-rules.md`
lists every rule and what enforces it.

## Adding a stack

The template is framework-free on purpose. Add what the project needs:

- **HTTP backend (Express, Fastify, Hono, Adonis)**: install it, put route handlers in
  `src/modules/<context>/transport/`, and wire them in `src/main.ts`. Routes listed under
  `## Endpoints` in a spec are verified to exist.
- **React with Vite**: install `vite`, `react`, `@vitejs/plugin-react`, `eslint-plugin-react-hooks`.
  Switch `tsconfig.json` to `"extends": "@desle/typescript-foundation/tsconfig/bundler"` with
  `"jsx": "react-jsx"`, call `createEslintConfig({ rootDirectory: import.meta.dirname, environment: 'browser' })`
  and append the React plugin config, and set `sourceExtensions: ['.ts', '.tsx']` in
  `foundation.config.ts`. Use `views/`, `components/` and `providers/` layers.
- **Vue**: as above with `vue-tsc` and `eslint-plugin-vue`, plus `sourceExtensions: ['.ts', '.vue']`
  and `typecheckedExtraExtensions: ['.vue']`.

Until a new file type is read by the architecture checks, TypeScript and ESLint, `pnpm run verify`
fails and names the tool that skips it, so a half-finished stack setup cannot pass the gate.

## Updating the foundation

The `dependency-update` workflow runs every Monday. It updates dependencies within their
ranges (including the foundation), runs `pnpm run sync` and the gate, and opens a pull request
with the result. Major foundation versions (new rules that can fail) need a manual
`pnpm add -D "github:Desle/typescript-foundation#semver:^3.0.0"`.
