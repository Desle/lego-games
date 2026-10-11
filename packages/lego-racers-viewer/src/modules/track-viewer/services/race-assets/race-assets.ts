import { decodeSoundBank } from '@lego-games/lego-racers/audio'
import { decodeBitmap, getBitmapColors } from '@lego-games/lego-racers/bitmap'
import { parseFontDatabase } from '@lego-games/lego-racers/font-database'
import { buildBitmapFont, getFontImagePixels } from '@lego-games/lego-racers/font-rendering'
import { parseImageDatabase } from '@lego-games/lego-racers/image-database'
import type { ImageDefinition } from '@lego-games/lego-racers/image-database'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getDriverPartBytes } from '@lego-games/lego-racers/car-builder'
import { loadRaceDefinition } from '@lego-games/lego-racers/race'
import type {
  LoadRaceOptions,
  RaceDefinition,
  RaceRacerDefinition,
} from '@lego-games/lego-racers/race'
import {
  loadBuiltCarScene,
  loadBuiltDriverScene,
  RACER_FILE_DIRECTORY,
} from '@lego-games/lego-racers/racer-appearance'
import type { ModelResourceNames } from '@lego-games/lego-racers/racer-appearance'
import { parseRaceDescription } from '@lego-games/lego-racers/race-description'
import {
  COMMON_DIRECTORY,
  getRaceBackgroundWorldPath,
  getRaceSkyPath,
  getRaceWorldPaths,
  loadModelScene,
  loadScene,
} from '@lego-games/lego-racers/scene'
import { parseSky } from '@lego-games/lego-racers/sky'
import { getString, parseStringTable } from '@lego-games/lego-racers/string-table'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import { HUD_FONT_NAMES } from '../../types/hud-fonts/hud-fonts.ts'
import type {
  EffectModels,
  HudBitmapFont,
  HudFonts,
  HudImage,
  RaceAssets,
  RaceGameFiles,
  RacerModels,
} from './race-assets.types.ts'

// The race the original starts first; the menus choose another through `LoadRaceOptions.raceFolder`.
const DEFAULT_RACE_FOLDER = 'RACEC0R0'
const ENGLISH_DIRECTORY = `${COMMON_DIRECTORY}\\ENGLISH`
const SEPARATOR = '\\'
// The image database flag for a colour key (IMAGE_KEYWORD_2B_FLAG, 0x20).
const COLOR_KEY_FLAG = 0x20
const loadResourceModel = (archive: JamArchive, names: ModelResourceNames): ModelScene =>
  loadModelScene(archive, {
    directory: RACER_FILE_DIRECTORY,
    textureNames: [names.textureDatabaseName.toUpperCase()],
    materialNames: [names.materialLibraryName.toUpperCase()],
    meshNames: [names.modelName.toUpperCase()],
    skeletonName: names.skeletonName === '' ? null : names.skeletonName.toUpperCase(),
    animationName: names.animationName === '' ? null : names.animationName.toUpperCase(),
  })

// The files a racer's appearance names (RacerSet_SetupRacer 0x0043b480): the champion's body, the chassis's wheels and
// the driver's model.
const getBodyModel = (archive: JamArchive, racer: RaceRacerDefinition): ModelScene | null => {
  if (racer.appearance.bodyModel !== null)
    return loadResourceModel(archive, racer.appearance.bodyModel)
  const design = racer.savedCar?.design ?? null
  return design === null ? null : loadBuiltCarScene(archive, design)
}

const getBuiltDriver = (archive: JamArchive, racer: RaceRacerDefinition): ModelScene | null =>
  racer.savedCar === null
    ? null
    : loadBuiltDriverScene(archive, getDriverPartBytes(racer.savedCar.record))

const getRacerModels = (archive: JamArchive, racer: RaceRacerDefinition): RacerModels => {
  const { appearance } = racer
  return Object.freeze({
    body: getBodyModel(archive, racer),
    wheels: loadResourceModel(archive, appearance.wheelModel),
    driver:
      appearance.driverModel === null
        ? getBuiltDriver(archive, racer)
        : loadResourceModel(archive, appearance.driverModel),
  })
}

// The effect models name materials the power-up libraries hold (GAMEDATA\COMMON POWERUP, GRAPPLE, BARREL, DBRICKS).
const EFFECT_TEXTURE_LIBRARIES = ['POWERUP', 'BARREL', 'DBRICKS']
const EFFECT_MATERIAL_LIBRARIES = ['POWERUP', 'GRAPPLE', 'BARREL', 'DBRICKS']

const loadEffectModel = (archive: JamArchive, name: string, isSkeletal: boolean): ModelScene =>
  loadModelScene(archive, {
    directory: RACER_FILE_DIRECTORY,
    textureNames: EFFECT_TEXTURE_LIBRARIES,
    materialNames: EFFECT_MATERIAL_LIBRARIES,
    meshNames: [name],
    skeletonName: isSkeletal ? name : null,
    animationName: isSkeletal ? name : null,
  })

// 0x0045ba90 picks the brick material by kind: 1 pbrickP (red), 2 pbrickS (blue), 3 pbrickT (green), 4 pbrickM (yellow);
// POWERUP.MDB holds them. The brick model is drawn with that material in place of its own.
const BRICK_MATERIAL_NAMES: Readonly<Record<string, string>> = Object.freeze({
  projectile: 'pbrickP',
  shield: 'pbrickS',
  turbo: 'pbrickT',
  hazard: 'pbrickM',
})

const getModelWithMaterial = (model: ModelScene, materialName: string): ModelScene => {
  const materialIndex = model.scene.materials.findIndex(
    (material) => material.name === materialName
  )
  if (materialIndex === -1) return model
  return Object.freeze({
    ...model,
    scene: Object.freeze({
      ...model.scene,
      meshes: Object.freeze(
        model.scene.meshes.map((mesh) =>
          Object.freeze({
            ...mesh,
            materialIndices: Object.freeze(mesh.materialIndices.map(() => materialIndex)),
          })
        )
      ),
    }),
  })
}

const getPowerUpBrickModels = (model: ModelScene): Readonly<Record<string, ModelScene>> =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(BRICK_MATERIAL_NAMES).map(([kind, name]) => [
        kind,
        getModelWithMaterial(model, name),
      ])
    )
  )

const getEffectModels = (archive: JamArchive): EffectModels =>
  Object.freeze({
    rocket: loadEffectModel(archive, 'DMISSILE', true),
    barrel: loadEffectModel(archive, 'BARREL', false),
    magnet: loadEffectModel(archive, 'MAGNET04', true),
    spikedExplosion: loadEffectModel(archive, 'SPIKEXP', false),
    powerUpBricks: getPowerUpBrickModels(loadEffectModel(archive, 'PUBRICKY', true)),
    enhancementBrick: loadEffectModel(archive, 'ENHABRIK', true),
  })

const getHudImage = (archive: JamArchive, definition: ImageDefinition): HudImage | null => {
  const path = `${COMMON_DIRECTORY}${SEPARATOR}${definition.name.toUpperCase()}.BMP`
  try {
    const bitmap = decodeBitmap(archive.readFile(path))
    const colors = new Uint8Array(getBitmapColors(bitmap))
    if ((definition.flags & COLOR_KEY_FLAG) !== 0) {
      const [red, green, blue] = definition.keyword2bBytes
      for (let offset = 0; offset < colors.length; offset += 4) {
        if (colors[offset] === red && colors[offset + 1] === green && colors[offset + 2] === blue) {
          colors[offset + 3] = 0
        }
      }
    }
    return Object.freeze({
      name: definition.name,
      width: bitmap.width,
      height: bitmap.height,
      colors,
    })
  } catch {
    return null
  }
}

const readBank = (archive: JamArchive, path: string) => decodeSoundBank(archive.readFile(path))

// Hud_Initialize 0x00425d80: the two fonts of LEGOFNTS.FDB, built from the font bitmaps of the language folder.
const loadHudFonts = (archive: JamArchive): HudFonts => {
  const database = parseFontDatabase(archive.readFile(`${ENGLISH_DIRECTORY}\\LEGOFNTS.FDB`))
  const entries = Object.entries(HUD_FONT_NAMES).flatMap(([hudFont, fontName]) => {
    const definition = database.fonts.find((candidate) => candidate.name === fontName)
    if (definition === undefined) return []
    const bitmap = decodeBitmap(
      archive.readFile(`${ENGLISH_DIRECTORY}\\${fontName.toUpperCase()}.BMP`)
    )
    const font = buildBitmapFont(definition, bitmap)
    const hudBitmapFont: HudBitmapFont = Object.freeze({
      font,
      image: Object.freeze({
        name: fontName,
        width: bitmap.width,
        height: bitmap.height,
        colors: getFontImagePixels(bitmap, font.colorKey),
      }),
    })
    return [[hudFont, hudBitmapFont] as const]
  })
  return new Map(entries)
}

// Everything a race of Royal Knights Raceway needs from the player's files: the race definition, the worlds with
// the sky and the background, the racers' models, the HUD's strings and images, the sound banks and the music.
export const loadRaceAssets = (
  jam: Uint8Array,
  files: RaceGameFiles,
  options: LoadRaceOptions = {},
  sessionDefinition: RaceDefinition | null = null
): RaceAssets => {
  const archive = openJamArchive(jam)
  const raceFolder = options.raceFolder ?? DEFAULT_RACE_FOLDER
  const raceDirectory = `GAMEDATA\\${raceFolder}`
  const description = parseRaceDescription(
    archive.readFile(`${raceDirectory}\\${raceFolder}.RAB`),
    false
  )
  const definition = sessionDefinition ?? loadRaceDefinition(jam, files.executable, options)
  const scene = loadScene(archive, [
    ...getRaceWorldPaths(raceDirectory, description),
    ...(getRaceBackgroundWorldPath(raceDirectory, description) === null
      ? []
      : [getRaceBackgroundWorldPath(raceDirectory, description) ?? '']),
  ])
  const skyPath = getRaceSkyPath(raceDirectory, description)
  const imageDatabase = parseImageDatabase(archive.readFile(`${COMMON_DIRECTORY}\\LEGOIMGS.IDB`))
  const table = parseStringTable(archive.readFile(`${ENGLISH_DIRECTORY}\\GAME.SRF`))
  const trackBankName = description.trackSoundBank ?? ''
  const musicList = readBank(
    archive,
    `${raceDirectory}\\${(description.musicList ?? '').toUpperCase()}`
  )
  return Object.freeze({
    archive,
    definition,
    scene,
    background: Object.freeze({
      sky: skyPath === null ? null : parseSky(archive.readFile(skyPath)),
      backgroundWorldPath: getRaceBackgroundWorldPath(raceDirectory, description),
    }),
    racerModels: Object.freeze(definition.racers.map((racer) => getRacerModels(archive, racer))),
    effectModels: getEffectModels(archive),
    getString: (stringId: number) => getString(table, stringId) ?? '',
    imageNames: Object.freeze(imageDatabase.images.map((image) => image.name.toUpperCase())),
    hudFonts: loadHudFonts(archive),
    hudImages: new Map(
      imageDatabase.images.flatMap((image) => {
        const hudImage = getHudImage(archive, image)
        return hudImage === null ? [] : [[image.name.toUpperCase(), hudImage] as const]
      })
    ),
    generalSounds: readBank(archive, `${COMMON_DIRECTORY}\\GENERAL.SBK`),
    trackSounds: readBank(archive, `${raceDirectory}\\${trackBankName.toUpperCase()}.SBK`),
    trackSoundDirectory: raceDirectory,
    musicNames: Object.freeze(musicList.soundPaths),
    tunes: files.tunes,
  })
}
