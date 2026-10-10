# Audio (`.PCM`, `.SBK`, `.tun`)

Source: `LEGORacers.exe` (English, built 1999-07-22). Addresses are virtual addresses in that binary. `GolDP.dll` contains no audio code: none of `ALP`, `ADPCM`, `.pcm`, `.sbk` or a DirectSound import appear in it. The executable imports `DSOUND.dll`.

All audio is one ADPCM flavour inside an optional `ALP ` header. Sound effects (`.PCM`) are loaded whole from `LEGO.JAM` and decoded once into a static DirectSound buffer; sound banks (`.SBK`) are text lists of sound effects; music (`.tun`) is streamed from the game folder with `CreateFileA`/`ReadFile` and decoded chunk by chunk into a looping DirectSound buffer.

## Functions

| Address      | Role                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `0x00418100` | ADPCM mono decoder: one byte → two samples, high nibble first, state `{ predictor, stepIndex }`               |
| `0x00418200` | ADPCM mono decoder writing each sample to both channels of a stereo buffer (music)                            |
| `0x00418310` | ADPCM decoder for one channel of interleaved stereo: reads every other byte, writes every other sample        |
| `0x00418410` | Stereo decoder: calls `0x00418310` for left (even bytes) and right (odd bytes) in blocks of 0x200 bytes       |
| `0x004184c0` | ADPCM mono decoder with rate doubling: one byte → four samples, an average before each decoded sample         |
| `0x0041aa20` | Sound effect record reset: loaded 0, bits 16, channels 1, rate 11025, no data                                 |
| `0x0041aa60` | Sound effect loader: reads the header and the ADPCM data from the JAM                                         |
| `0x0041ac20` | Sound effect decode: picks `0x00418100`, `0x004184c0` or `0x00418410`, state starts at zero                   |
| `0x0041b7e0` | Creates the static DirectSound buffer (`WAVEFORMATEX` PCM); refuses a size of 0                               |
| `0x0041b8d0` | Sizes that buffer from the record (rate and size shifted left by the doubling flag), locks it, decodes        |
| `0x0041ae60` | Sound bank loader (`.SBK`): appends `.SBK` (`0x004be7f8`) if missing, reads lines, loads every sound          |
| `0x0041b5d0` | Lowercases `A`–`Z` in place                                                                                   |
| `0x0041b5f0` | Joins two strings into a buffer of a given size (here 0x104)                                                  |
| `0x0041a700` | Music list loader: same text layout as a sound bank (directory, count, lowercased names)                      |
| `0x0041a8a0` | Creates a music stream for list entry _n_ if its name contains `.tun` (`0x004be7ec`) or `.pcm` (`0x004be7e4`) |
| `0x0041a180` | Music stream constructor: buffer format 2 channels, 22050 Hz (`0x5622`), 88200 bytes/s, 2 s of buffer         |
| `0x0041a360` | Creates the streaming DirectSound buffer from that format (16-bit PCM)                                        |
| `0x00419d60` | Opens a `.tun`: reads 16 header bytes, seeks to the data, resets both channel states to zero                  |
| `0x004197a0` | Stream refill: `ReadFile` chunks, decodes with `0x00418410` (2 channels) or `0x00418200` (otherwise)          |
| `0x0044cff0` | Stream line reader; for files inside the JAM it calls `0x0044da70`                                            |
| `0x0044da70` | JAM line reader (vtable `0x004b0f70` + 8): CR LF, LF, `0x1a` and NUL end a line                               |
| `0x0044d190` | Builds the full path of a relative name (current directory, search paths) and uppercases it (`0x0044d4f0`)    |

## ADPCM

Tables (int32, little-endian), dumped from the executable:

- `0x004be640` index table: `-1 -1 -1 -1 2 4 6 8 -1 -1 -1 -1 2 4 6 8`
- `0x004be680` step table: 89 entries `7, 8, 9, … 29794, 32767`

Both are identical to the standard IMA ADPCM tables. The decoding is not standard IMA:

```
for each byte: nibble = byte >> 4, then nibble = byte & 0x0f     // high nibble first
  step       = stepTable[stepIndex]
  stepIndex  = clamp(stepIndex + indexTable[nibble], 0, 88)
  difference = ((nibble & 7) * step) >> 2                        // standard IMA adds step >> 3
  predictor  = nibble & 8 ? max(predictor - difference, -32768) : min(predictor + difference, 32767)
  output predictor
```

Predictor and step index start at 0 for every sound effect (`0x0041ac20`) and every time a stream is opened or loops (`0x00419d60`, `0x004197a0`). There are no per-block headers.

- Mono (`0x00418100`): byte _k_ → samples 2k, 2k+1.
- Doubled mono (`0x004184c0`): byte _k_ with decoded samples _a_, _b_ and the previous decoded sample _p_ (0 at the start) → `(p + a) >> 1, a, (a + b) >> 1, b` (arithmetic shifts, `SAR`).
- Stereo (`0x00418410`/`0x00418310`): even bytes are left, odd bytes right, each holding two samples of its channel; byte pair _k_ → frames 2k and 2k+1. The count is halved with a shift, so a trailing unpaired byte is not decoded.
- Music mono (`0x00418200`): as mono, each sample written to both channels.

## Sound effect (`.PCM`)

`0x0041aa60` reads the first 0x18 bytes (zero-filled when the file is shorter):

```
0x00  char[4]  "ALP "
0x04  int32    headerSize            data starts at headerSize + 8
0x08  char[4]  "ADPC"                 (the files have "ADPCM\0" then a zero byte)
0x0f  uint8    channelCount
0x10  int32    sampleRate             only when headerSize + 8 >= 0x11
```

- With `ALP ` and `ADPC`: channels from `0x0f`. If `headerSize + 8 < 0x11`, the rate is 11025 and the rate is doubled only for mono; otherwise the rate is read at `0x10` and doubled when it is at most 11025 (signed compare).
- Without them: the whole file is mono ADPCM at 11025 Hz, doubled.
- `dataSize = (fileSize - dataOffset) & ~3`; a failed read or a channel count of 0 or above 2 fails the load.
- `0x0041b8d0` creates a 16-bit PCM buffer of `(dataSize * 4) << doubled` bytes at `rate << doubled` Hz (`WAVEFORMATEX` via `0x0041b7e0`). A zero-size buffer is refused, so files with fewer than four data bytes never play.
- A stereo file with a rate of at most 11025 would get a doubled buffer that the stereo decoder fills only half of; no original file does this.

All 730 `.PCM` files in `LEGO.JAM` have `headerSize` 12 and are mono: 694 at 11025 Hz and 31 at 5512 Hz (both doubled, to 22050 and 11024 Hz), 5 at 44100 Hz. Eight files have fewer than four data bytes.

## Sound bank (`.SBK`)

Text read with `0x0044cff0`, which for JAM files is `0x0044da70`:

```
line 1   directory prefix          (0x104-byte buffer; empty in all but MENUDATA\GENC0R0.SBK, which has "Sounds\")
line 2   sound count               (4-byte buffer, parsed with atoi; no entries when <= 0)
line 3…  one sound file name per line, count lines
```

`0x0044da70` reads at most `min(bufferSize, bytesLeft)` bytes in 64-byte chunks. LF ends a line and is consumed, and a CR right before it is dropped; `0x1a` and NUL also end a line and are consumed. A line that fills the whole buffer without an end keeps `bufferSize - 1` characters and consumes `bufferSize` bytes; a last line without an end keeps everything. At the end of the file the read fails: a name that cannot be read becomes an empty path. (The original leaves its directory and count buffers uninitialised in that case; the port treats them as empty.)

Each name is lowercased with `0x0041b5d0` and joined to the directory with `0x0041b5f0` into 0x104 bytes (at most 259 characters), then loaded with `0x0041aa60`. Lines after the counted names are ignored.

The game resolves those paths against its current directory with `0x0044d190`; in the English `LEGO.JAM` every one of the 63 banks names sounds in its own directory, and together they reference every `.PCM` in the archive.

## Music (`.tun`)

`0x00419d60` opens the file with `CreateFileA` and, when it is longer than 15 bytes, reads 16 bytes:

```
0x00  char[4]  "ALP "
0x04  int32    headerSize            data starts at headerSize + 8 (16 in every file)
0x08  char[4]  "ADPC"
0x0f  uint8    channelCount          2 → stereo decoder, anything else → mono on both channels
```

Without `ALP `/`ADPC` the data starts at 0 and is treated as mono. The stream buffer is always 16-bit stereo at 22050 Hz (`0x0041a180`, `0x0041a360`); there is no rate field. `0x004197a0` refills the buffer in multiples of 0x1000 bytes and keeps the decoder state across chunks, so the played samples equal one continuous decode of the data; when the stream loops it seeks back to the data and resets the state.

All 50 `.tun` files in the English game folder are stereo with `headerSize` 8.
