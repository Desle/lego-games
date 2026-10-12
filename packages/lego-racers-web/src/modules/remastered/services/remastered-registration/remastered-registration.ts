import { registerViewerExtension } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type { DevelopmentSelector } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import {
  applyHighDefinitionTexture,
  getHighDefinitionVariant,
} from '../high-definition-texture/high-definition-texture.ts'
import { createLDrawCarDrawing } from '../ldraw-car/ldraw-car-drawing.ts'
import { getTextureVariants } from '../texture-variants/texture-variants.ts'
import { getWidescreenDisplay } from '../widescreen-display/widescreen-display.ts'

export const getIsRemasteredRequested = (search: string): boolean =>
  import.meta.env.DEV && new URLSearchParams(search).has('hd')

const BRICKS_PARAMETER = 'bricks'
const CLASSIC_BRICKS = 'classic'
const LDRAW_BRICKS = 'LDraw'

// Built cars are drawn from LDraw parts unless the URL says `bricks=classic`.
const getIsLDrawRequested = (search: string): boolean =>
  new URLSearchParams(search).get(BRICKS_PARAMETER) !== CLASSIC_BRICKS

// Plugs the remastered features into the viewer's extension points; `?hd=<variant>` picks the texture pack.
export const registerRemastered = (search: string) =>
  registerViewerExtension({
    onTextureCreated: (event) => applyHighDefinitionTexture(event, search),
    getRaceDisplay: getWidescreenDisplay,
    getBuiltCarDrawing: (request) =>
      getIsLDrawRequested(search) ? createLDrawCarDrawing(request).object : null,
  })

// Switching packs reloads the page: textures are swapped as they load.
const selectTextureVariant = (variant: string | null) => {
  const url = new URL(globalThis.location.href)
  if (variant === null) url.searchParams.delete('hd')
  else url.searchParams.set('hd', variant)
  globalThis.location.assign(url.toString())
}

// Switching bricks reloads the page too: cars are drawn as they are made. LDraw needs the remastered layer, which `?hd` turns on.
const selectBricks = (bricks: string | null) => {
  const url = new URL(globalThis.location.href)
  if (bricks === null) url.searchParams.set(BRICKS_PARAMETER, CLASSIC_BRICKS)
  else url.searchParams.delete(BRICKS_PARAMETER)
  if (!url.searchParams.has('hd')) url.searchParams.set('hd', '')
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
    {
      label: 'Bricks (reloads)',
      options: [LDRAW_BRICKS],
      selected:
        getIsRemasteredRequested(search) && getIsLDrawRequested(search) ? LDRAW_BRICKS : null,
      onSelected: selectBricks,
    },
  ]
}
