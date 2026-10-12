import type { SoundListener, SoundMix, SoundSource } from '../../types/race-audio.types.ts'

// 0x004afac8 and 0x004afacc: the pan's strength on the listener's two sides.
const PAN_STRENGTH = 0.7
// 0x004afb28 and 0x004afb2c: the volume curve (-3000 hundredths of a decibel at the quietest) and its cut-off.
const QUIETEST_VOLUME = 3000
const SILENT_VOLUME = 0.005
const SILENT_DIRECT_SOUND_VOLUME = -10000
// 0x004afb30: DirectSound's pan units per unit of pan.
const PAN_UNITS = 2500

// 0x00417de0 (a sound object relative to the listener) and 0x00419650 / 0x00419680 (the DirectSound values): inside the
// minimum distance the sound plays at its own volume, between the squared limits it fades linearly in the squared
// distance and beyond the maximum it is silent; the pan follows how far to the listener's side the sound is. The
// Doppler shift of 0x00417de0 (c = 343) uses the listener's speed in units per millisecond and is below 0.01%, so
// it is left out.
export const getSoundMix = (listener: SoundListener, source: SoundSource): SoundMix => {
  const deltaX = source.position.x - listener.position.x
  const deltaY = source.position.y - listener.position.y
  const deltaZ = source.position.z - listener.position.z
  const squaredDistance = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
  const squaredMinimum = source.minimumDistance * source.minimumDistance
  const squaredMaximum = source.maximumDistance * source.maximumDistance
  if (squaredDistance >= squaredMaximum && squaredDistance > squaredMinimum) {
    return Object.freeze({
      volume: 0,
      directSoundVolume: SILENT_DIRECT_SOUND_VOLUME,
      pan: 0,
      directSoundPan: 0,
      pitch: source.pitch,
    })
  }
  const volume =
    squaredDistance > squaredMinimum
      ? (1 - (squaredDistance - squaredMinimum) / (squaredMaximum - squaredMinimum)) * source.volume
      : source.volume
  const sideDistance =
    listener.left.x * deltaX + listener.left.y * deltaY + listener.left.z * deltaZ
  const pan =
    volume === 0 || squaredDistance === 0
      ? 0
      : (sideDistance / squaredDistance) *
        (sideDistance > 0 ? -PAN_STRENGTH : PAN_STRENGTH) *
        sideDistance
  const directSoundVolume =
    volume < SILENT_VOLUME
      ? SILENT_DIRECT_SOUND_VOLUME
      : -QUIETEST_VOLUME - Math.trunc(-QUIETEST_VOLUME * volume)
  const directSoundPan = Math.trunc(pan * PAN_UNITS)
  return Object.freeze({ volume, directSoundVolume, pan, directSoundPan, pitch: source.pitch })
}
