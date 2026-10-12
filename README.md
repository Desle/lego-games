# lego-games

Exact TypeScript ports of classic LEGO PC games. The ports are reverse-engineered from the original binaries and run on the player's own game files. LEGO Racers (1999) comes first.

## Setup

```sh
pnpm install   # also points git at .git-hooks/
pnpm run ci
```

Needs Node 24 (`.nvmrc`) and pnpm (`corepack enable`).

Put your own copy of the game in `original-files/` (gitignored), for example `original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM`. Tests that need it skip when it's missing.

## Play

You need your own copy of LEGO Racers (1999); nothing of it ships here.

```sh
pnpm install
pnpm --filter @lego-games/lego-racers-viewer build
pnpm --filter @lego-games/lego-racers-viewer exec vite preview
```

Open the printed address in Chrome or Edge, click **Choose your LEGO Racers game folder** and pick the folder holding `LEGO.JAM`, `LEGORacers.exe` and the `.tun` music (the `Game Files` folder of the install). The files are read in the browser and never uploaded; the game opens on the main menu. Other browsers get a folder input instead of the directory picker. Menus: arrow keys, Enter, Escape; the race controls are listed on the start screen. Saves are kept in the browser (IndexedDB). `pnpm run dev:viewer` also offers the developer panel and the development-files button.

## Reverse engineering

Ghidra 12 (`brew install ghidra`) analyses `LEGORacers.exe` and `GolDP.dll` into `reverse-engineering/ghidra/`. The scripts in `reverse-engineering/scripts/` decompile functions headlessly, for example:

```sh
"$(brew --prefix ghidra)/libexec/support/analyzeHeadless" "$PWD/reverse-engineering/ghidra" LegoRacers \
  -process LEGORacers.exe -noanalysis -readOnly -scriptPath "$PWD/reverse-engineering/scripts" \
  -postScript DecompileAddressRange.java 0044d700 0044e400
```

For quick lookups, start the query servers once and ask them directly:

```sh
reverse-engineering/ghidra-server.sh start
reverse-engineering/ghidra-query.sh exe decompile 0044d900
reverse-engineering/ghidra-query.sh dll disassemble 10032840 100328b1
```

Findings are written up in `.docs/reverse-engineering/`.

## Daily use

| Command                             | What it does                                   |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm run check`                    | Typecheck, lint, architecture checks, tests    |
| `pnpm run ci`                       | The full gate CI runs; also runs on `git push` |
| `pnpm --filter <package> run check` | One package only                               |
| `pnpm run format`                   | ESLint auto-fix, then Prettier                 |
