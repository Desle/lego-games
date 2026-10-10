#!/bin/sh
# Starts (or stops) long-running Ghidra query servers for LEGORacers.exe and GolDP.dll.
# They work on a private copy of reverse-engineering/ghidra, so the shared project stays copyable.
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
copy="$root/reverse-engineering/ghidra-server"
logs="$root/reverse-engineering/ghidra-server-logs"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
headless="$(brew --prefix ghidra)/libexec/support/analyzeHeadless"

stop() {
  for port in 18301 18302; do echo shutdown | nc -w 2 127.0.0.1 "$port" >/dev/null 2>&1 || true; done
}

case "${1:-start}" in
  stop) stop ;;
  start)
    stop
    rm -rf "$copy" && mkdir -p "$logs" "$copy"
    for pair in "LEGORacers.exe 18301" "GolDP.dll 18302"; do
      set -- $pair
      # Ghidra locks a project per process, so each server gets its own copy.
      cp -R "$root/reverse-engineering/ghidra" "$copy/$2"
      rm -f "$copy/$2"/*.lock "$copy/$2"/*.lock~
      nohup "$headless" "$copy/$2" LegoRacers -process "$1" -noanalysis -readOnly \
        -scriptPath "$root/reverse-engineering/scripts" -postScript QueryServer.java "$2" \
        > "$logs/$1.log" 2>&1 &
    done
    for port in 18301 18302; do
      tries=0
      until echo help | nc -w 2 127.0.0.1 "$port" >/dev/null 2>&1; do
        tries=$((tries + 1)); [ "$tries" -gt 120 ] && { echo "server on $port did not start; see $logs" >&2; exit 1; }
        sleep 1
      done
    done
    echo "Ghidra query servers ready: exe on 18301, dll on 18302" ;;
  *) echo "usage: $0 [start|stop]" >&2; exit 2 ;;
esac
