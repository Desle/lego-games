import { decodeSoundBank } from '@lego-games/lego-racers/audio'
import { decodeBitmap, getBitmapColors } from '@lego-games/lego-racers/bitmap'
import { parseImageDatabase } from '@lego-games/lego-racers/image-database'
import type { ImageDefinition } from '@lego-games/lego-racers/image-database'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadRaceDefinition } from '@lego-games/lego-racers/race'
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
import type { HudImage, RaceAssets, RaceGameFiles, RacerModels } from './race-assets.types.ts'

const RACE_DIRECTORY = 'GAMEDATA\\RACEC0R0'
const RACE_DESCRIPTION_PATH = `${RACE_DIRECTORY}\\RACEC0R0.RAB`
const ENGLISH_DIRECTORY = `${COMMON_DIRECTORY}\\ENGLISH`
const SEPARATOR = '\\'
// The image database flag for a colour key (IMAGE_KEYWORD_2B_FLAG, 0x20).
const COLOR_KEY_FLAG = 0x20
// PLACEHOLDER: until the chassis and driver databases are ported every racer takes the next prefix; the car is
// `<prefix>CM` and the driver `<prefix>PELVIS` (GAMEDATA\COMMON).
const RACER_MODEL_PREFIXES: readonly string[] = Object.freeze(['RR', 'KK', 'VV', 'JT', 'BB', 'GM'])

const getRacerModels = (archive: JamArchive, prefix: string): RacerModels =>
  Object.freeze({
    car: loadModelScene(archive, {
      directory: COMMON_DIRECTORY,
      textureNames: [`${prefix}CM`],
      materialNames: [`${prefix}CM`],
      meshNames: [`${prefix}CM`],
    }),
    driver: loadModelScene(archive, {
      directory: COMMON_DIRECTORY,
      textureNames: [`${prefix}PELVIS`],
      materialNames: [`${prefix}PELVIS`],
      meshNames: [`${prefix}PELVIS`],
    }),
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

// Everything a race of Royal Knights Raceway needs from the player's files: the race definition, the worlds with
// the sky and the background, the racers' models, the HUD's strings and images, the sound banks and the music.
export const loadRaceAssets = (jam: Uint8Array, files: RaceGameFiles): RaceAssets => {
  const archive = openJamArchive(jam)
  const description = parseRaceDescription(archive.readFile(RACE_DESCRIPTION_PATH), false)
  const definition = loadRaceDefinition(jam, files.executable)
  const scene = loadScene(archive, [
    ...getRaceWorldPaths(RACE_DIRECTORY, description),
    ...(getRaceBackgroundWorldPath(RACE_DIRECTORY, description) === null
      ? []
      : [getRaceBackgroundWorldPath(RACE_DIRECTORY, description) ?? '']),
  ])
  const skyPath = getRaceSkyPath(RACE_DIRECTORY, description)
  const imageDatabase = parseImageDatabase(archive.readFile(`${COMMON_DIRECTORY}\\LEGOIMGS.IDB`))
  const table = parseStringTable(archive.readFile(`${ENGLISH_DIRECTORY}\\GAME.SRF`))
  const trackBankName = description.trackSoundBank ?? ''
  const musicList = readBank(
    archive,
    `${RACE_DIRECTORY}\\${(description.musicList ?? '').toUpperCase()}`
  )
  return Object.freeze({
    archive,
    definition,
    scene,
    background: Object.freeze({
      sky: skyPath === null ? null : parseSky(archive.readFile(skyPath)),
      backgroundWorldPath: getRaceBackgroundWorldPath(RACE_DIRECTORY, description),
    }),
    racerModels: Object.freeze(
      definition.racers.map((_, index) =>
        getRacerModels(archive, RACER_MODEL_PREFIXES[index % RACER_MODEL_PREFIXES.length] ?? 'RR')
      )
    ),
    getString: (stringId: number) => getString(table, stringId) ?? '',
    imageNames: Object.freeze(imageDatabase.images.map((image) => image.name.toUpperCase())),
    hudImages: new Map(
      imageDatabase.images.flatMap((image) => {
        const hudImage = getHudImage(archive, image)
        return hudImage === null ? [] : [[image.name.toUpperCase(), hudImage] as const]
      })
    ),
    generalSounds: readBank(archive, `${COMMON_DIRECTORY}\\GENERAL.SBK`),
    trackSounds: readBank(archive, `${RACE_DIRECTORY}\\${trackBankName.toUpperCase()}.SBK`),
    trackSoundDirectory: RACE_DIRECTORY,
    musicNames: Object.freeze(musicList.soundPaths),
    tunes: files.tunes,
  })
}
