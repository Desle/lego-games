# Feature: token-reader

## Behaviour

Reads the Gol engine's tokenized binary files (`.GDB`, `.MDB`, `.WDB` and the other `*DB` files in `LEGO.JAM`) token by token, exactly as `GolDP.dll`'s binary token reader (`0x10030300`) does, including its compact number encodings, repeats, macros and the array-header shorthand. The implementation is copied verbatim from the `world` module (branch `feature/world-format`) so that every format module shares one reader.

## User flows

- **Read tokens**: a format parser passes the file's bytes to `createTokenReader` and calls `getNextToken` until it returns `END_OF_FILE` (0); value tokens leave their value in `getIntegerValue`, `getFloatValue` or `getStringValue`.
- **Read typed values**: a parser calls `readInteger`, `readFloat`, `readString`, `readArrayCount` or the `expect…` helpers, which fail with the same error the original shows when the next token is wrong.

## Invariants

- A zero byte, or no byte left, reads as `END_OF_FILE`; a value cut short by the end of the file is a syntax error.
- Every failure the original reports through its fatal-error callback throws a `TokenReaderError` carrying the original error kind; the original exits the game at that point.
- Input whose original outcome depends on memory outside the macro table throws `TokenReaderOverflowError` instead of guessing.

## Out of scope

The text (`.txt`) reader and the token writers in `GolDP.dll`, and the meaning of keywords, which belongs to each format's module.
