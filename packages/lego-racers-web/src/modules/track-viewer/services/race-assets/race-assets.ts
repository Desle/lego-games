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
  getFigureAnimations,
  getRacerFilePath,
  loadBuiltCarScene,
  getRacerModelFiles,
  loadBuiltDriverScene,
  RACER_FILE_DIRECTORY,
} from '@lego-games/lego-racers/racer-appearance'
import { parseRaceDescription } from '@lego-games/lego-racers/race-description'
import {
  COMMON_DIRECTORY,
  getRaceBackgroundWorldPath,
  getRaceSkyPath,
  getRaceWorldPaths,
  loadModelScene,
  loadScene,
  loadSceneOnto,
} from '@lego-games/lego-racers/scene'
import { parseSky } from '@lego-games/lego-racers/sky'
import { parseModel } from '@lego-games/lego-racers/model'
import { readWorld } from '@lego-games/lego-racers/world'
import { getString, parseStringTable } from '@lego-games/lego-racers/string-table'
import type { ModelScene, Scene } from '@lego-games/lego-racers/scene'
import { HUD_FONT_NAMES } from '../../types/hud-fonts/hud-fonts.ts'
import type {
  EffectModels,
  HudBitmapFont,
  HudFonts,
  HudImage,
  ModelLoader,
  RaceAssets,
  RaceGameFiles,
  RacerModels,
} from './race-assets.types.ts'

// The race the original starts first; the menus choose another through `LoadRaceOptions.raceFolder`.
const DEFAULT_RACE_FOLDER = 'RACEC0R0'
// The warp's tunnel world (LEGORacers.exe 0x0045d940 draws its `dbricks` and `dtube`).
export const WARP_WORLD_PATH = `${COMMON_DIRECTORY}\\TURBO3.WDB`
// The champion ghost's car (Ghost_Initialize 0x00422420 loads "ghost" from GAMEDATA\COMMON): `ghost2` (the wheels), `ghostb2` (the
// body) and `ghostdr` (the driver).
export const GHOST_WORLD_PATH = `${COMMON_DIRECTORY}\\GHOST.WDB`
const ENGLISH_DIRECTORY = `${COMMON_DIRECTORY}\\ENGLISH`
const SEPARATOR = '\\'
// The image database flag for a colour key (IMAGE_KEYWORD_2B_FLAG, 0x20).
const COLOR_KEY_FLAG = 0x20
// The race loads its worlds and every racer's models into one container (LEGORacers.exe 0x00432e20): a texture name a
// database registered first keeps its texture, so a car's `adnubint` is the track's and a later racer's textures
// yield to an earlier racer's of the same name. The chain starts with the race's scene and grows with each model.
const createModelLoader = (archive: JamArchive, raceScene: Scene): ModelLoader => {
  let container = raceScene
  return (names) => {
    const model = loadModelScene(archive, getRacerModelFiles(names), container)
    container = model.scene
    return model
  }
}

// The files a racer's appearance names (RacerSet_SetupRacer 0x0043b480): the champion's body, the chassis's wheels and
// the driver's model.
const getBodyModel = (
  archive: JamArchive,
  racer: RaceRacerDefinition,
  loadModel: ModelLoader
): ModelScene | null => {
  if (racer.appearance.bodyModel !== null) return loadModel(racer.appearance.bodyModel)
  const design = racer.savedCar?.design ?? null
  return design === null ? null : loadBuiltCarScene(archive, design)
}

const getBuiltDriver = (archive: JamArchive, racer: RaceRacerDefinition): ModelScene | null =>
  racer.savedCar === null
    ? null
    : loadBuiltDriverScene(archive, getDriverPartBytes(racer.savedCar.record))

const getRacerModels = (
  archive: JamArchive,
  racer: RaceRacerDefinition,
  loadModel: ModelLoader
): RacerModels => {
  const { appearance } = racer
  return Object.freeze({
    body: getBodyModel(archive, racer, loadModel),
    wheels: loadModel(appearance.wheelModel),
    driver:
      appearance.driverModel === null
        ? getBuiltDriver(archive, racer)
        : loadModel(appearance.driverModel),
  })
}

// The effect models name materials the power-up libraries hold (GAMEDATA\COMMON POWERUP, GRAPPLE, BARREL, DBRICKS).
const EFFECT_TEXTURE_LIBRARIES = [
  'DTURBO0',
  'DTURBO1',
  'DTURBO2',
  'POWERUP',
  'CURSE',
  'BARREL',
  'WARPHOLE',
  'CGREEN',
  'DBRICKS',
  'DTUBE',
]
const EFFECT_MATERIAL_LIBRARIES = [
  'DTURBO0',
  'DTURBO1',
  'DTURBO2',
  'POWERUP',
  'GRAPPLE',
  'WARPHOLE',
  'CURSE',
  'BARREL',
  'CGREEN',
  'DBRICKS',
  'DTUBE',
]

const loadEffectModel = (
  archive: JamArchive,
  name: string,
  isSkeletal: boolean,
  skeletonName: string = name
): ModelScene =>
  loadModelScene(archive, {
    directory: RACER_FILE_DIRECTORY,
    textureNames: EFFECT_TEXTURE_LIBRARIES,
    materialNames: EFFECT_MATERIAL_LIBRARIES,
    meshNames: [name],
    skeletonName: isSkeletal ? skeletonName : null,
    animationName: isSkeletal ? skeletonName : null,
  })

// POWERUP.WDB lists a turbo's instances TurboL0..2 (dt0burn, dt1burn, dt2cburn) and turb0f1, turb0f2 .. turb2f2.
const TURBO_MODEL_NAMES = [
  [
    ['DT0BURN', 'TurboL0'],
    ['DT0FLA1', 'turb0f1'],
    ['DT0FLA2', 'turb0f2'],
  ],
  [
    ['DT1BURN', 'TurboL1'],
    ['DT1FLA1', 'turb1f1'],
    ['DT1FLA2', 'turb1f2'],
  ],
  [
    ['DT2CBURN', 'TurboL2'],
    ['DT2CFLA1', 'turb2f1'],
    ['DT2CFLA2', 'turb2f2'],
  ],
]

// POWERUP.WDB lists the four shields (instances shield0..3) on one skeleton and animation, the one of SHEOUT0.
const SHIELD_MODEL_NAMES = ['SHEOUT0', 'SHEOUT1', 'SHEOUT2', 'SHEOUT3']

// LEGORacers.exe 0x00458a80 looks up the materials pbrickP, pbrickM, pbrickS and pbrickT; 0x0045ba90 gives a brick of
// kind 1 to 4 the models P, S, T and M: red, blue, green and yellow. The brick mesh itself names the yellow ptrailM.
const BRICK_DEFAULT_MATERIAL = 'ptrailM'
const BRICK_MATERIALS: Readonly<Record<string, string>> = Object.freeze({
  projectile: 'pbrickP',
  shield: 'pbrickS',
  turbo: 'pbrickT',
  hazard: 'pbrickM',
})

const getBrickInMaterial = (model: ModelScene, materialName: string): ModelScene => {
  const { materials } = model.scene
  const target = materials.findLastIndex((material) => material.name === materialName)
  const source = materials.findLastIndex((material) => material.name === BRICK_DEFAULT_MATERIAL)
  if (target === -1 || source === -1) return model
  return Object.freeze({
    ...model,
    scene: Object.freeze({
      ...model.scene,
      meshes: Object.freeze(
        model.scene.meshes.map((mesh) =>
          Object.freeze({
            ...mesh,
            materialIndices: Object.freeze(
              mesh.materialIndices.map((index) => (index === source ? target : index))
            ),
          })
        )
      ),
    }),
  })
}

// 0x0045d940 draws the world of TURBO3.WDB: the instances `dbricks` and `dtube`, each with its own skeleton and animation.
const getWarpTunnel = (archive: JamArchive, scene: Scene): Scene =>
  loadSceneOnto(archive, scene, [WARP_WORLD_PATH])

const getWarpTextureScroll = (archive: JamArchive): readonly [number, number] => {
  const values = readWorld(archive.readFile(WARP_WORLD_PATH)).skeletonInstances.find(
    (instance) => instance.name === 'dtube'
  )?.keyword3fValues
  return [values?.[0] ?? 0, values?.[1] ?? 0]
}

// The scroll per second of an instance's texture: keyword 0x3f of the instance in POWERUP.WDB (warpprt, shield0,
// turb0f1 ...), which the original adds to the texture coordinates while the figure lives.
const getInstanceTextureScroll = (
  archive: JamArchive,
  instanceName: string
): readonly [number, number] => {
  const world = readWorld(archive.readFile(`${COMMON_DIRECTORY}\\POWERUP.WDB`))
  const values = [...world.meshInstances, ...world.skeletonInstances].find(
    (instance) => instance.name === instanceName
  )?.keyword3fValues
  return [values?.[0] ?? 0, values?.[1] ?? 0]
}

const getEffectMaterials = (archive: JamArchive): Scene =>
  loadModelScene(archive, {
    directory: RACER_FILE_DIRECTORY,
    textureNames: EFFECT_TEXTURE_LIBRARIES,
    materialNames: EFFECT_MATERIAL_LIBRARIES,
    meshNames: [],
    skeletonName: null,
    animationName: null,
  }).scene

// The ghost car's parts are drawn at the scale of their model (GDB keyword 0x33), as a racer's car is.
const getGhostModels = (
  archive: JamArchive,
  scene: Scene,
  isTimeTrial: boolean
): Pick<RaceAssets, 'ghostScene' | 'ghostScales'> => {
  if (!isTimeTrial) return { ghostScene: null, ghostScales: Object.freeze({}) }
  const ghostScene = loadSceneOnto(archive, scene, [GHOST_WORLD_PATH])
  const scales = ghostScene.instances
    .filter((instance) => instance.worldPath === GHOST_WORLD_PATH)
    .map((instance) => {
      const mesh = ghostScene.meshes[instance.levels[0]?.meshIndex ?? -1]
      return [
        instance.name,
        mesh === undefined ? 1 : parseModel(archive.readFile(mesh.path)).scale,
      ] as const
    })
  return { ghostScene, ghostScales: Object.freeze(Object.fromEntries(scales)) }
}

const getEffectModels = (archive: JamArchive, raceScene: Scene): EffectModels =>
  Object.freeze({
    materials: getEffectMaterials(archive),
    rocket: loadEffectModel(archive, 'DMISSILE', true),
    rocketAnimations: getFigureAnimations(archive.readFile(getRacerFilePath('DMISSILE', 'ADB'))),
    barrel: loadEffectModel(archive, 'BARREL', false),
    magnet: loadEffectModel(archive, 'MAGNET04', true),
    plainExplosion: loadEffectModel(archive, 'HEDRA01', false),
    spikedExplosion: loadEffectModel(archive, 'SPIKEXP', false),
    warpPortal: loadEffectModel(archive, 'WARPHOLE', false),
    warpPortalScroll: getInstanceTextureScroll(archive, 'warpprt'),
    shieldScroll: getInstanceTextureScroll(archive, 'shield0'),
    turbos: TURBO_MODEL_NAMES.map((names) =>
      names.map(([name, instanceName]) => ({
        model: loadEffectModel(archive, name ?? '', true),
        animations: getFigureAnimations(archive.readFile(getRacerFilePath(name ?? '', 'ADB'))),
        scroll: getInstanceTextureScroll(archive, instanceName ?? ''),
      }))
    ),
    shields: SHIELD_MODEL_NAMES.map((name) => loadEffectModel(archive, name, true, 'SHEOUT0')),
    shieldAnimations: getFigureAnimations(archive.readFile(getRacerFilePath('SHEOUT0', 'ADB'))),
    powerUpBricks: Object.freeze(
      Object.fromEntries(
        Object.entries(BRICK_MATERIALS).map(([kind, materialName]) => [
          kind,
          getBrickInMaterial(loadEffectModel(archive, 'PUBRICKY', true), materialName),
        ])
      )
    ),
    enhancementBrick: loadEffectModel(archive, 'ENHABRIK', true),
    warpTunnel: getWarpTunnel(archive, raceScene),
    warpTextureScroll: getWarpTextureScroll(archive),
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
// The minimap's picture is a texture of the track's worlds (`igd_map`, 128 x 128), which the HUD draws as an image.
export const MAP_IMAGE_NAME = 'IGD_MAP'
const getMapImage = (scene: Scene): readonly (readonly [string, HudImage])[] => {
  const texture = scene.textures.find((candidate) => candidate.name === 'igd_map')
  const bitmap = texture?.bitmap ?? null
  return bitmap === null
    ? []
    : [
        [
          MAP_IMAGE_NAME,
          {
            name: MAP_IMAGE_NAME,
            width: bitmap.width,
            height: bitmap.height,
            colors: bitmap.colors,
          },
        ] as const,
      ]
}

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
  const loadModel = createModelLoader(archive, scene)
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
    racerModels: Object.freeze(
      definition.racers.map((racer) => getRacerModels(archive, racer, loadModel))
    ),
    effectModels: getEffectModels(archive, scene),
    ...getGhostModels(archive, scene, definition.ghost !== null),
    getString: (stringId: number) => getString(table, stringId) ?? '',
    imageNames: Object.freeze(imageDatabase.images.map((image) => image.name.toUpperCase())),
    hudFonts: loadHudFonts(archive),
    displayBounds: description.displayBounds,
    hudImages: new Map([
      ...imageDatabase.images.flatMap((image) => {
        const hudImage = getHudImage(archive, image)
        return hudImage === null ? [] : [[image.name.toUpperCase(), hudImage] as const]
      }),
      ...getMapImage(scene),
    ]),
    generalSounds: readBank(archive, `${COMMON_DIRECTORY}\\GENERAL.SBK`),
    trackSounds: readBank(archive, `${raceDirectory}\\${trackBankName.toUpperCase()}.SBK`),
    trackSoundDirectory: raceDirectory,
    musicNames: Object.freeze(musicList.soundPaths),
    tunes: files.tunes,
  })
}
