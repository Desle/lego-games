import { getIsNameList } from '../texture-variants/texture-variants.ts'
import { DEVELOPMENT_HIGH_DEFINITION_AUDIO_ROUTE } from './high-definition-audio-route.ts'

const DEFAULT_VARIANT = 'resample-48k'

// `audio=<variant>` picks an audio pack folder next to `?hd`; a bare `audio` uses the default one; none leaves the sounds alone.
export const getHighDefinitionAudioVariant = (search: string): string | null => {
  const parameters = new URLSearchParams(search)
  if (!parameters.has('hd') || !parameters.has('audio')) return null
  const variant = parameters.get('audio') ?? ''
  return variant === '' ? DEFAULT_VARIANT : variant
}

export const getHighDefinitionAudioUrl = (archivePath: string, variant: string): string =>
  `${DEVELOPMENT_HIGH_DEFINITION_AUDIO_ROUTE}/${encodeURIComponent(variant)}/${getAudioKey(archivePath)}`

// `MENUDATA\SOUNDS\BIRD2.PCM` is `MENUDATA/SOUNDS/BIRD2.wav` in a pack; a tune `MUSIC\theme.tun` is `MUSIC/theme.wav`.
export const getAudioKey = (archivePath: string): string =>
  archivePath.replaceAll('\\', '/').replace(/\.[^./]+$/, '.wav')

const indexes = new Map<string, Promise<ReadonlySet<string>>>()

// The files the pack has (lower case), asked once, so sounds the pack lacks cost no request.
const getPackIndex = (variant: string): Promise<ReadonlySet<string>> => {
  const known = indexes.get(variant)
  if (known !== undefined) return known
  const index = fetch(`${DEVELOPMENT_HIGH_DEFINITION_AUDIO_ROUTE}/${encodeURIComponent(variant)}/`)
    .then(async (response): Promise<ReadonlySet<string>> => {
      const names: unknown = response.ok ? await response.json() : null
      return new Set(getIsNameList(names) ? names : [])
    })
    .catch(() => new Set<string>())
  indexes.set(variant, index)
  return index
}

// The pack's recording of a sound or tune, decoded at the context's rate over the same duration; null when the pack has none.
export const loadHighDefinitionSound = async (
  context: BaseAudioContext,
  archivePath: string,
  variant: string
): Promise<AudioBuffer | null> => {
  const index = await getPackIndex(variant)
  if (!index.has(getAudioKey(archivePath).toLowerCase())) return null
  const response = await fetch(getHighDefinitionAudioUrl(archivePath, variant))
  if (!response.ok) return null
  return context.decodeAudioData(await response.arrayBuffer())
}
