import { registerViewerExtension } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { DevelopmentSelector } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import {
  applyHighDefinitionTexture,
  getHighDefinitionVariant,
} from '../high-definition-texture/high-definition-texture.ts'
import { getTextureVariants } from '../texture-variants/texture-variants.ts'
import { getWidescreenDisplay } from '../widescreen-display/widescreen-display.ts'

export const getIsRemasteredRequested = (search: string): boolean =>
  import.meta.env.DEV && new URLSearchParams(search).has('hd')

// Plugs the remastered features into the viewer's extension points; `?hd=<variant>` picks the texture pack.
export const registerRemastered = (search: string) =>
  registerViewerExtension({
    onTextureCreated: (event) => applyHighDefinitionTexture(event, search),
    getRaceDisplay: getWidescreenDisplay,
  })

// Switching packs reloads the page: textures are swapped as they load.
const selectTextureVariant = (variant: string | null) => {
  const url = new URL(globalThis.location.href)
  if (variant === null) url.searchParams.delete('hd')
  else url.searchParams.set('hd', variant)
  globalThis.location.assign(url.toString())
}

// The developer panel's choices for the remastered layer (offered whether or not it is on).
export const getRemasteredSelectors = async (
  search: string
): Promise<readonly DevelopmentSelector[]> => {
  const variants = await getTextureVariants()
  return [
    {
      label: 'Textures (reloads)',
      options: variants,
      selected: getIsRemasteredRequested(search) ? getHighDefinitionVariant(search) : null,
      onSelected: selectTextureVariant,
    },
  ]
}
