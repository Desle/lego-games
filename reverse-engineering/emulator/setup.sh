#!/bin/sh
# Creates the emulator's virtualenv (Unicorn, pinned in requirements.txt) unless it already exists.
set -eu
directory=$(cd "$(dirname "$0")" && pwd)
if [ ! -x "$directory/.venv/bin/python" ]; then
  python3 -m venv "$directory/.venv"
  "$directory/.venv/bin/pip" install --quiet --require-virtualenv -r "$directory/requirements.txt"
fi
game_files="$directory/../../original-files/Lego_Racers_Win_Files_EN/Game Files"
for name in LEGORacers.exe GolDP.dll LEGO.JAM; do
  if [ ! -e "$game_files/$name" ]; then
    echo "Missing $name in original-files/Lego_Racers_Win_Files_EN/Game Files (symlink the player's copy there); the differential suites will skip." >&2
  fi
done
