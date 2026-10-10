# Feature: named-record

## Behaviour

Reads the frame all five exe database files share, `0x27 [ count ] { (0x27 name { keywords }) * count }`, with the name table rules of `0x00411870` and `0x004119a0`.

## User flows

- Parse a database: a loader passes the bytes and a block reader to `readNamedRecords`, which gives the records and `readByteCount`; the block reader loops with `readKeywordBlock`. Look a record up: `findNamedRecord(records, name)`.

## Invariants

- A name is at most eight characters; a longer one is an error. A name that appears twice stops with `DuplicateNameError`. An unknown keyword is a syntax error. Lookups compare eight characters.

## Out of scope

The meaning of any keyword; the original's hash table layout.
