# JAM archive (`LEGO.JAM`)

Source: `LEGORacers.exe` (English, built 1999-07-22). Addresses are virtual addresses in that binary.

| Address      | Role                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------ |
| `0x0042bbb0` | Opens `lego.jam` (string at `0x004bea88`)                                                  |
| `0x0044d870` | Attach stream, read 4 bytes at offset 0, compare with `LJAM` (`0x004c1a58`)                |
| `0x0044d900` | Find file by path: returns offset and size, or 6 (segment over 12 chars) / 8 (not found)   |
| `0x0044d9c0` | Same path walk, stores the found file entry at `this + 0x30`                               |
| `0x0044da70` | Reads one text line from a file in 64-byte chunks (CR/LF, `0x1a` and NUL end a line)       |
| `0x0044dbe0` | Directory node constructor: 0x24 bytes, archive offset at `+0x10`, root offset is 4        |
| `0x0044dc00` | Frees a directory node recursively                                                         |
| `0x0044dc60` | Finds a subdirectory: lazy-loads the node, then `strncmp(entry, name, 12)`, first match    |
| `0x0044dcc0` | Finds a file: lazy-loads the node, then `strncmp(entry, name, 12)`, first match            |
| `0x0044dd20` | Loads a directory node: file count, 20-byte file entries, subdirectory count, 16-byte ones |

## Layout

All integers are little-endian `uint32`. The original reassembles every integer byte by byte, which has no effect on little-endian x86.

```
0x00  char[4]  "LJAM"
0x04  directory (root)

directory:
  uint32 fileCount                 (> 100000 → "Error reading JAM file.")
  fileCount × { char[12] name, uint32 offset, uint32 size }
  uint32 directoryCount            (> 100000 → "Error reading JAM file.")
  directoryCount × { char[12] name, uint32 offset }   // offset of that directory's own listing
```

Names are NUL-padded and not NUL-terminated when 12 characters long. The English `LEGO.JAM` holds 5,444 files, and the files cover the archive exactly to its end (19,592,720 bytes).

`GolDP.dll` contains the same error string but nothing in the DLL refers to it.
