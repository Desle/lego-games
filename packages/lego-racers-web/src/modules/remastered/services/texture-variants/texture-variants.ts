import { DEVELOPMENT_HIGH_DEFINITION_AUDIO_ROUTE } from '../high-definition-audio/high-definition-audio-route.ts'
import { DEVELOPMENT_HIGH_DEFINITION_ROUTE } from '../high-definition-texture/high-definition-route.ts'

export const getIsNameList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

// The pack folders a dev server route finds; none when it offers no route (a production build).
const getPackVariants = async (route: string): Promise<readonly string[]> => {
  const response = await fetch(`${route}/`).catch(() => null)
  if (response === null || !response.ok) return []
  const names: unknown = await response.json().catch(() => null)
  return getIsNameList(names) ? names : []
}

export const getTextureVariants = (): Promise<readonly string[]> =>
  getPackVariants(DEVELOPMENT_HIGH_DEFINITION_ROUTE)

export const getAudioVariants = (): Promise<readonly string[]> =>
  getPackVariants(DEVELOPMENT_HIGH_DEFINITION_AUDIO_ROUTE)
