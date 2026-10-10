#!/bin/sh
# Usage: ghidra-query.sh <exe|dll> <command...>
#   decompile <address...> | disassemble <start> <end> | xrefs <address>
#   bytes <address> <count> | strings <text> | function <address>
set -eu
case "$1" in
  exe) port=18301 ;;
  dll) port=18302 ;;
  *) echo "first argument must be exe or dll" >&2; exit 2 ;;
esac
shift
printf '%s\n' "$*" | nc 127.0.0.1 "$port"
