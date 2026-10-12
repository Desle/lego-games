import {
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { DevelopmentSelector } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import {
  getHighDefinitionAudioVariant,
  loadHighDefinitionSound,
} from '../high-definition-audio/high-definition-audio.ts'
import {
  applyHighDefinitionPicture,
  applyHighDefinitionTexture,
  getHighDefinitionVariant,
} from '../high-definition-texture/high-definition-texture.ts'
import { getAudioVariants, getTextureVariants } from '../texture-variants/texture-variants.ts'
import { getNativeMenuSurfaceScale } from '../widescreen-display/menu-surface.ts'
import { getWidescreenDisplay } from '../widescreen-display/widescreen-display.ts'

export const getIsRemasteredRequested = (search: string): boolean =>
  import.meta.env.DEV && new URLSearchParams(search).has('hd')

// Plugs the remastered features into the viewer's extension points; `?hd=<variant>` picks the texture pack and
// `audio=<variant>` the audio pack.
export const registerRemastered = (search: string) => {
  const audioVariant = getHighDefinitionAudioVariant(search)
  registerViewerExtension({
    ...NEUTRAL_EXTENSION,
    onTextureCreated: (event) => applyHighDefinitionTexture(event, search),
    onPictureCreated: (event) => applyHighDefinitionPicture(event, search),
    getRaceDisplay: getWidescreenDisplay,
    getMenuSurfaceScale: getNativeMenuSurfaceScale,
    getSoundReplacement: (context, archivePath) =>
      audioVariant === null
        ? Promise.resolve(null)
        : loadHighDefinitionSound(context, archivePath, audioVariant),
  })
}

// Switching packs reloads the page: textures and sounds are swapped as they load. The audio pack needs `?hd` too.
const selectVariant = (parameter: string, variant: string | null) => {
  const url = new URL(globalThis.location.href)
  if (variant === null) url.searchParams.delete(parameter)
  else url.searchParams.set(parameter, variant)
  if (parameter === 'audio' && variant !== null && !url.searchParams.has('hd')) {
    url.searchParams.set('hd', '')
  }
  globalThis.location.assign(url.toString())
}

// The developer panel's choices for the remastered layer (offered whether or not it is on).
export const getRemasteredSelectors = async (
  search: string
): Promise<readonly DevelopmentSelector[]> => {
  const [textureVariants, audioVariants] = await Promise.all([
    getTextureVariants(),
    getAudioVariants(),
  ])
  return [
    {
      label: 'Textures (reloads)',
      options: textureVariants,
      selected: getIsRemasteredRequested(search) ? getHighDefinitionVariant(search) : null,
      onSelected: (variant) => selectVariant('hd', variant),
    },
    {
      label: 'Audio (reloads)',
      options: audioVariants,
      selected: getHighDefinitionAudioVariant(search),
      onSelected: (variant) => selectVariant('audio', variant),
    },
  ]
}
