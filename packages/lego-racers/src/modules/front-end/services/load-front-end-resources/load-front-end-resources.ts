import { decodeBitmap } from '../../../bitmap/index.ts'
import { loadBuilderCatalog, loadSavedCars } from '../../../car-builder/index.ts'
import type { BuilderCatalog, SavedCar } from '../../../car-builder/index.ts'
import { parseAnimation } from '../../../animation/index.ts'
import { getSkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import { parseDriverDatabase } from '../../../driver-database/index.ts'
import type { DriverDatabase } from '../../../driver-database/index.ts'
import { parseBodyPartCatalog } from '../../../figure-builder/index.ts'
import type { BodyPartCatalog } from '../../../figure-builder/index.ts'
import { parseSaveFile } from '../../../save-data/index.ts'
import type { SaveRacer } from '../../../save-data/index.ts'
import { parseCircuitDatabase } from '../../../circuit-database/index.ts'
import { parseFontDatabase } from '../../../font-database/index.ts'
import { buildBitmapFont, getFontImagePixels } from '../../../font-rendering/index.ts'
import { IMAGE_KEYWORD_2B_FLAG, parseImageDatabase } from '../../../image-database/index.ts'
import type { ImageDefinition } from '../../../image-database/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import { parseMenuDescription, parseMenuStyles } from '../../../menu-file/index.ts'
import { parseRaceCatalog } from '../../../race-catalog/index.ts'
import { getString, parseStringTable } from '../../../string-table/index.ts'
import type { StringTable } from '../../../string-table/index.ts'
import type {
  FrontEndFontEntry,
  FrontEndImage,
  FrontEndResources,
  FrontEndScreenFiles,
} from '../../types/front-end.types.ts'

const MENU_DIRECTORY = 'MENUDATA'
const DEFAULT_SAVE_PATH = 'MENUDATA\\DEFAULT.LRS'
const MENU_FIGURE_ANIMATION_PATH = 'MENUDATA\\LEGOMAN.ADB'
const DRIVER_DATABASE_PATH = 'MENUDATA\\PARTDB\\DRIVERS.DDB'
const BODY_PART_CATALOG_PATH = 'MENUDATA\\PARTDB\\BODYPART.PCB'
const SEPARATOR = '\\'

const getPath = (...segments: readonly string[]): string => segments.join(SEPARATOR)

const getStrings = (table: StringTable): readonly string[] =>
  Array.from({ length: table.offsets.length }, (_, index) => getString(table, index) ?? '')

// LEGORacers.exe 0x0042cb90, 0x0042d020, 0x0042d1e0, 0x0042d300: the front end opens GImages and GFonts, the circuits
// and the races, MENUTEXT.SRF and CIRCUIT.SRF of the language, and each screen opens its own files when it starts.
// Images and fonts decode on first use.
export const loadFrontEndResources = (
  archive: JamArchive,
  language = 'ENGLISH'
): FrontEndResources => {
  const paths = new Set(archive.getFilePaths())
  const readTable = (path: string) => parseStringTable(archive.readFile(path))
  const menuText = readTable(getPath(MENU_DIRECTORY, language, 'MENUTEXT.SRF'))
  const circuitText = readTable(getPath(MENU_DIRECTORY, language, 'CIRCUIT.SRF'))
  const circuits = parseCircuitDatabase(archive.readFile(getPath(MENU_DIRECTORY, 'LEGORACE.CRB')))
  const races = parseRaceCatalog(
    archive.readFile(getPath(MENU_DIRECTORY, 'LEGORACE.RCB')),
    circuits
  )

  const imageDefinitions = new Map<string, ImageDefinition>()
  for (const path of paths) {
    const isMenuImageDatabase =
      path.startsWith(`${MENU_DIRECTORY}${SEPARATOR}`) &&
      path.split(SEPARATOR).length === 2 &&
      path.toUpperCase().endsWith('.IDB')
    if (!isMenuImageDatabase) continue
    for (const definition of parseImageDatabase(archive.readFile(path)).images) {
      if (!imageDefinitions.has(definition.name)) imageDefinitions.set(definition.name, definition)
    }
  }
  const fontDatabase = parseFontDatabase(
    archive.readFile(getPath(MENU_DIRECTORY, language, 'GFONTS.FDB'))
  )

  const imageCache = new Map<string, FrontEndImage | null>()
  const getImage = (name: string): FrontEndImage | null => {
    const key = name.toLowerCase()
    const cached = imageCache.get(key)
    if (cached !== undefined) return cached
    const definition = imageDefinitions.get(key)
    const path = getPath(MENU_DIRECTORY, `${name.toUpperCase()}.BMP`)
    let image: FrontEndImage | null = null
    if (definition !== undefined && paths.has(path)) {
      const bitmap = decodeBitmap(archive.readFile(path))
      const isKeyed = (definition.flags & IMAGE_KEYWORD_2B_FLAG) !== 0
      image = Object.freeze({
        name: key,
        width: bitmap.width,
        height: bitmap.height,
        colors: getFontImagePixels(bitmap, isKeyed ? definition.keyword2bBytes : null),
      })
    }
    imageCache.set(key, image)
    return image
  }

  const fontCache = new Map<string, FrontEndFontEntry | null>()
  const getFontEntry = (name: string) => {
    const key = name.toLowerCase()
    const cached = fontCache.get(key)
    if (cached !== undefined) return cached
    const definition = fontDatabase.fonts.find((candidate) => candidate.name === key)
    const path = getPath(MENU_DIRECTORY, language, `${key.toUpperCase()}.BMP`)
    let entry: FrontEndFontEntry | null = null
    if (definition !== undefined && paths.has(path)) {
      const bitmap = decodeBitmap(archive.readFile(path))
      const font = buildBitmapFont(definition, bitmap)
      entry = {
        font,
        image: Object.freeze({
          name: key,
          width: bitmap.width,
          height: bitmap.height,
          colors: getFontImagePixels(bitmap, font.colorKey),
        }),
      }
    }
    fontCache.set(key, entry)
    return entry
  }

  const screenCache = new Map<string, FrontEndScreenFiles | null>()
  const getScreenFiles = (screenName: string): FrontEndScreenFiles | null => {
    const key = screenName.toUpperCase()
    const cached = screenCache.get(key)
    if (cached !== undefined) return cached
    const descriptionPath = getPath(MENU_DIRECTORY, `${key}.MIB`)
    const stylesPath = getPath(MENU_DIRECTORY, `${key}.MSB`)
    const files = paths.has(descriptionPath)
      ? Object.freeze({
          description: parseMenuDescription(archive.readFile(descriptionPath)),
          styles: paths.has(stylesPath) ? parseMenuStyles(archive.readFile(stylesPath)) : null,
        })
      : null
    screenCache.set(key, files)
    return files
  }

  let builderCatalog: BuilderCatalog | null = null
  const getBuilderCatalog = (): BuilderCatalog => {
    builderCatalog ??= loadBuilderCatalog((path) => archive.readFile(path))
    return builderCatalog
  }
  let racerTemplate: SaveRacer | null = null
  const getRacerTemplate = (): SaveRacer => {
    racerTemplate ??= parseSaveFile(archive.readFile(DEFAULT_SAVE_PATH)).racers[0] ?? null
    if (racerTemplate === null) throw new RangeError('DEFAULT.LRS has no racer')
    return racerTemplate
  }

  let defaultCar: SavedCar | null = null
  const getDefaultCar = (): SavedCar => {
    defaultCar ??= loadSavedCars((path) => archive.readFile(path), DEFAULT_SAVE_PATH)[0] ?? null
    if (defaultCar === null) throw new RangeError('DEFAULT.LRS has no racer')
    return defaultCar
  }
  let driverCatalog: BodyPartCatalog | null = null
  const getDriverCatalog = (): BodyPartCatalog => {
    driverCatalog ??= parseBodyPartCatalog(archive.readFile(BODY_PART_CATALOG_PATH))
    return driverCatalog
  }

  let driverDatabase: DriverDatabase | null = null
  const getDriverDatabase = (): DriverDatabase => {
    driverDatabase ??= parseDriverDatabase(archive.readFile(DRIVER_DATABASE_PATH))
    return driverDatabase
  }

  let menuFigureAnimation: SkeletalAnimation | null = null
  const getMenuFigureAnimation = (): SkeletalAnimation => {
    menuFigureAnimation ??= getSkeletalAnimation(
      parseAnimation(archive.readFile(MENU_FIGURE_ANIMATION_PATH))
    )
    return menuFigureAnimation
  }

  return Object.freeze({
    getBuilderCatalog,
    getDriverDatabase,
    getMenuFigureAnimation,
    getRacerTemplate,
    getDefaultCar,
    getDriverCatalog,
    menuNames: getStrings(readTable(getPath(MENU_DIRECTORY, 'MENUNAME.SRF'))),
    getMenuText: (stringId: number) => getString(menuText, stringId) ?? '',
    getCircuitText: (stringId: number) => getString(circuitText, stringId) ?? '',
    circuits,
    races,
    globalStyles: parseMenuStyles(archive.readFile(getPath(MENU_DIRECTORY, 'GSTYLES.MSB'))),
    getScreenFiles,
    getFont: (fontName: string) => getFontEntry(fontName)?.font ?? null,
    getImage,
    getFontImage: (fontName: string) => getFontEntry(fontName)?.image ?? null,
  })
}
