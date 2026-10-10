# Feature: audio

## Behaviour

Decodes LEGO Racers' audio exactly as `LEGORacers.exe` does: `.PCM` sound effects and `.SBK` sound banks from `LEGO.JAM`, and `.tun` music from the game folder. Sounds and music come back as the 16-bit PCM samples the original writes into its DirectSound buffers, with their sample rate and channel count, so a browser can play them bit for bit.

## User flows

- **Decode a sound effect**: the game passes the bytes of a `.PCM` file and gets the channel count, the stored and played sample rates, whether the rate was doubled, and the interleaved samples. A channel count other than 1 or 2, or a header that ends beyond the file, fails with `SoundEffectReadError`.
- **Decode a sound bank**: the game passes the bytes of a `.SBK` file and gets its directory line, its declared sound count and the path of every sound in it (directory plus the lowercased file name).
- **Decode music**: the game passes the bytes of a `.tun` file and gets 22050 Hz interleaved stereo samples and the channel count the file declares. A header that ends beyond the file fails with `MusicReadError`.

## Invariants

- The ADPCM tables are the ones dumped from `0x004be640` and `0x004be680`; nibbles decode high first with a difference of `(magnitude * step) >> 2`, predictor and step index start at zero and are clamped to the 16-bit range and to 0–88.
- A sound effect decodes `(fileSize - dataOffset) & ~3` bytes. A mono sound stored at 11025 Hz or less (or without a stored rate) plays at twice its rate with an interpolated sample before every decoded one; a sound with fewer than four data bytes decodes to no samples.
- Music always plays as 22050 Hz stereo: a file declaring two channels decodes its alternating left and right bytes, any other channel count is mono written to both channels.
- Sound bank lines are read like the original JAM line reader: CR LF, LF, `0x1a` and NUL end a line, paths are at most 259 characters and the count is read from a three-character buffer with `atoi`.
- Decoders never mutate their input and return frozen objects.

## Out of scope

Playback, mixing, volume, panning, 3D positioning and looping of sounds and music (DirectSound), and resolving a sound bank's paths against the game's current directory and search paths (`0x0044d190`).
