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
import {
  getLookLabels,
  getLookPreset,
  getLookPresetFromLabel,
  LOOK_APPEARANCES,
  LOOK_PARAMETER,
  setActiveLookPreset,
} from '../ldraw-car/ldraw-look.ts'
import {
  createPerformancePass,
  getIsPerformanceRequested,
} from '../performance-monitor/performance-monitor.ts'
import { setShaderPrecompiler } from '../ldraw-car/shader-precompiler.ts'
import { createLDrawPickupDrawing } from '../ldraw-pickup/ldraw-pickup-drawing.ts'
import { loadLDrawModelIndex, getLDrawModelIndex } from '../ldraw-models/ldraw-model-client.ts'
import { createLDrawRacerCar } from '../ldraw-racer-model/ldraw-racer-car.ts'
import { createLDrawRacerDriver } from '../ldraw-racer-model/ldraw-racer-driver.ts'
import { CHAMPION_CAR_CODES, CHASSIS_NAMES } from '../ldraw-racer-model/known-racer-models.ts'
import {
  getShadowMode,
  getShadowModeFromLabel,
  getShadowModeLabel,
  REAL_SHADOWS_LABEL,
  SCENERY_SHADOWS_LABEL,
  SHADOWS_PARAMETER,
} from '../real-shadows/shadow-mode.ts'
import { ShadowMode } from '../real-shadows/shadow-mode.types.ts'
import { createShadowPass } from '../real-shadows/shadow-pass.ts'
import { getTrackSun } from '../real-shadows/sun-selection.ts'
import { getAudioVariants, getTextureVariants } from '../texture-variants/texture-variants.ts'
import { getNativeMenuSurfaceScale } from '../widescreen-display/menu-surface.ts'
import { getWidescreenDisplay } from '../widescreen-display/widescreen-display.ts'

export const getIsRemasteredRequested = (search: string): boolean =>
  import.meta.env.DEV && new URLSearchParams(search).has('hd')

const BRICKS_PARAMETER = 'bricks'
const CLASSIC_BRICKS = 'classic'
const LDRAW_BRICKS = 'LDraw'
const CHASSIS_PARAMETER = 'chassis'
const GAME_CHASSIS = 'game'

// A chassis without a recipe in the models folder is drawn from the game's own geometry only when the URL says `chassis=game`.
const getIsChassisFallbackRequested = (search: string): boolean =>
  new URLSearchParams(search).get(CHASSIS_PARAMETER) === GAME_CHASSIS

// Built cars are drawn from LDraw parts unless the URL says `bricks=classic`.
const getIsLDrawRequested = (search: string): boolean =>
  new URLSearchParams(search).get(BRICKS_PARAMETER) !== CLASSIC_BRICKS

// Plugs the remastered features into the viewer's extension points; `?hd=<variant>` picks the texture pack and
// `audio=<variant>` the audio pack.
export const registerRemastered = async (search: string) => {
  await loadLDrawModelIndex()
  setActiveLookPreset(getLookPreset(search))
  const settings = {
    search,
    isChassisFallbackUsed: getIsChassisFallbackRequested(search),
  }
  const audioVariant = getHighDefinitionAudioVariant(search)
  registerViewerExtension({
    ...NEUTRAL_EXTENSION,
    onTextureCreated: (event) => applyHighDefinitionTexture(event, search),
    onPictureCreated: (event) => applyHighDefinitionPicture(event, search),
    getRaceDisplay: getWidescreenDisplay,
    getMenuSurfaceScale: getNativeMenuSurfaceScale,
    getCarDrawing: (request) =>
      getIsLDrawRequested(search) ? createLDrawRacerCar(request, settings) : null,
    getDriverDrawing: (request) =>
      getIsLDrawRequested(search) ? createLDrawRacerDriver(request, search) : null,
    getRaceRenderPass: (request) => {
      const mode = getShadowMode(search)
      const shadowPass =
        mode === ShadowMode.CLASSIC
          ? null
          : createShadowPass(
              request,
              mode,
              getTrackSun(search, request.trackKey, request.trackGroup)
            )
      const pass = getIsPerformanceRequested(search)
        ? createPerformancePass(request, shadowPass)
        : shadowPass
      // Programs depend on the scene's lights: with none yet (no car has posed), compiling now would be wasted.
      setShaderPrecompiler((object) =>
        request.trackScene.getObjectByProperty('isDirectionalLight', true) === undefined
          ? Promise.resolve()
          : request.renderer
              .compileAsync(object, request.camera, request.trackScene)
              .then(() => undefined)
      )
      return {
        beforeRender: () => pass?.beforeRender(),
        dispose: () => {
          setShaderPrecompiler(null)
          pass?.dispose()
        },
      }
    },
    getEffectModelDrawing: (request) =>
      getIsLDrawRequested(search) ? createLDrawPickupDrawing(request) : null,
    getSelections: () => [
      `textures=${getHighDefinitionVariant(search)}`,
      `audio=${audioVariant ?? 'none'}`,
      `bricks=${getIsLDrawRequested(search) ? LDRAW_BRICKS : CLASSIC_BRICKS}`,
      `chassis=${getIsChassisFallbackRequested(search) ? GAME_CHASSIS : 'recipe'}`,
      `shadows=${getShadowMode(search)}`,
      `look=${getLookPreset(search)}`,
    ],
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

// Switching bricks reloads the page too: cars are drawn as they are made. LDraw needs the remastered layer, which `?hd` turns on.
const selectBricks = (bricks: string | null) => {
  const url = new URL(globalThis.location.href)
  if (bricks === null) url.searchParams.set(BRICKS_PARAMETER, CLASSIC_BRICKS)
  else url.searchParams.delete(BRICKS_PARAMETER)
  if (!url.searchParams.has('hd')) url.searchParams.set('hd', '')
  globalThis.location.assign(url.toString())
}

// Switching the chassis fallback reloads the page too: cars are drawn as they are made.
const selectChassis = (chassis: string | null) => {
  const url = new URL(globalThis.location.href)
  if (chassis === null) url.searchParams.delete(CHASSIS_PARAMETER)
  else url.searchParams.set(CHASSIS_PARAMETER, GAME_CHASSIS)
  if (!url.searchParams.has('hd')) url.searchParams.set('hd', '')
  globalThis.location.assign(url.toString())
}

// Switching the look reloads the page too: the plastic is made with each car.
const selectLook = (label: string | null) => {
  const url = new URL(globalThis.location.href)
  url.searchParams.set(LOOK_PARAMETER, getLookPresetFromLabel(label))
  if (!url.searchParams.has('hd')) url.searchParams.set('hd', '')
  globalThis.location.assign(url.toString())
}

// Switching shadows reloads the page: the shadow pass is made with the race.
const selectShadows = (label: string | null) => {
  const url = new URL(globalThis.location.href)
  url.searchParams.set(SHADOWS_PARAMETER, getShadowModeFromLabel(label))
  if (!url.searchParams.has('hd')) url.searchParams.set('hd', '')
  globalThis.location.assign(url.toString())
}

const getModelOption = (name: string, isPresent: boolean): string =>
  `${name}: ${isPresent ? 'LDraw model' : 'no model'}`

// The developer panel's choices for the remastered layer (offered whether or not it is on).
export const getRemasteredSelectors = async (
  search: string
): Promise<readonly DevelopmentSelector[]> => {
  const [textureVariants, audioVariants] = await Promise.all([
    getTextureVariants(),
    getAudioVariants(),
    loadLDrawModelIndex(),
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
    {
      label: 'Bricks (reloads)',
      options: [LDRAW_BRICKS],
      selected:
        getIsRemasteredRequested(search) && getIsLDrawRequested(search) ? LDRAW_BRICKS : null,
      onSelected: selectBricks,
    },
    {
      label: 'Chassis without a recipe (reloads)',
      options: ['Game geometry'],
      selected: getIsChassisFallbackRequested(search) ? 'Game geometry' : null,
      onSelected: selectChassis,
    },
    {
      label: 'Shadows (reloads): Classic blobs / Real / Real + scenery',
      options: [REAL_SHADOWS_LABEL, SCENERY_SHADOWS_LABEL],
      selected: getIsRemasteredRequested(search) ? getShadowModeLabel(getShadowMode(search)) : null,
      onSelected: selectShadows,
    },
    {
      label: 'Look (reloads): Manual / Studio / Photo / LEGO Movie',
      options: getLookLabels(),
      selected: getIsRemasteredRequested(search)
        ? LOOK_APPEARANCES[getLookPreset(search)].label
        : null,
      onSelected: selectLook,
    },
    getModelSelector(),
  ]
}

// Which cars and chassis have a model in the models folder; the list is for reading (the folder is the choice).
const getModelSelector = (): DevelopmentSelector => {
  const index = getLDrawModelIndex()
  const cars = CHAMPION_CAR_CODES.map((code) =>
    getModelOption(code, index.cars[code] !== undefined)
  )
  const chassis = CHASSIS_NAMES.map((name) =>
    getModelOption(`chassis ${name}`, index.chassis[name] !== undefined)
  )
  const carCount = cars.filter((option) => option.endsWith('LDraw model')).length
  const chassisCount = chassis.filter((option) => option.endsWith('LDraw model')).length
  return {
    label: `LDraw models: ${String(carCount)} of ${String(cars.length)} cars, ${String(chassisCount)} of ${String(chassis.length)} chassis`,
    options: [...cars, ...chassis],
    selected: null,
    onSelected: () => undefined,
  }
}
