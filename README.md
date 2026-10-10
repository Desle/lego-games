# lego-games

Exact TypeScript ports of classic LEGO PC games. The ports are reverse-engineered from the original binaries and run on the player's own game files. LEGO Racers (1999) comes first.

## Setup

```sh
pnpm install   # also points git at .git-hooks/
pnpm run ci
```

Needs Node 24 (`.nvmrc`) and pnpm (`corepack enable`).

Put your own copy of the game in `original-files/` (gitignored), for example `original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM`. Tests that need it skip when it's missing.

## Reverse engineering

Ghidra 12 (`brew install ghidra`) analyses `LEGORacers.exe` and `GolDP.dll` into `reverse-engineering/ghidra/`. The scripts in `reverse-engineering/scripts/` decompile functions headlessly, for example:

```sh
"$(brew --prefix ghidra)/libexec/support/analyzeHeadless" "$PWD/reverse-engineering/ghidra" LegoRacers \
  -process LEGORacers.exe -noanalysis -readOnly -scriptPath "$PWD/reverse-engineering/scripts" \
  -postScript DecompileAddressRange.java 0044d700 0044e400
```

Findings are written up in `.docs/reverse-engineering/`.

## Daily use

| Command                             | What it does                                   |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm run check`                    | Typecheck, lint, architecture checks, tests    |
| `pnpm run ci`                       | The full gate CI runs; also runs on `git push` |
| `pnpm --filter <package> run check` | One package only                               |
| `pnpm run format`                   | ESLint auto-fix, then Prettier                 |
