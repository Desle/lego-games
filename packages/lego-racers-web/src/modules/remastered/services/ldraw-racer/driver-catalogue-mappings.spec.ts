import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { parseBodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import {
  DRIVER_CATALOGUE_GAPS,
  LDRAW_FACES,
  LDRAW_HATS,
  LDRAW_LEGS,
  LDRAW_TORSOS,
} from './driver-catalogue-mappings.ts'

const JAM_PATH = join(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const LIBRARY_PARTS = join(homedir(), 'ldraw', 'parts')
const isJamPresent = existsSync(JAM_PATH)
const isLibraryPresent = existsSync(LIBRARY_PARTS)
const CATALOG_PATH = 'MENUDATA\\PARTDB\\BODYPART.PCB'
const HOOK_TORSO_TYPE = 1

const readCatalog = () =>
  parseBodyPartCatalog(
    openJamArchive(new Uint8Array(readFileSync(JAM_PATH))).readFile(CATALOG_PATH)
  )

describe('the driver catalogue mappings', () => {
  it('has a row for each hat, face, torso and pair of legs, the first hat being none', () => {
    // Arrange / Act
    const sizes = [LDRAW_HATS.length, LDRAW_FACES.length, LDRAW_TORSOS.length, LDRAW_LEGS.length]

    // Assert
    expect([sizes, LDRAW_HATS[0]?.hats]).toEqual([[36, 30, 29, 20], []])
  })

  it('puts a visor on every helmet of the game that has one', () => {
    // Arrange
    const helmetNames = ['helmtrr', 'helmt01', 'helmt02', 'helmt03', 'helmtvvs', 'nh_hats']

    // Act
    const visorCounts = helmetNames.map(
      (name) =>
        LDRAW_HATS.find((entry) => entry.catalogName === name)?.hats.filter(
          (hat) => hat.part === '2447'
        ).length
    )

    // Assert
    expect(visorCounts).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('says why each entry stands for its part', () => {
    // Arrange / Act
    const entries = [...LDRAW_HATS, ...LDRAW_FACES, ...LDRAW_TORSOS, ...LDRAW_LEGS]

    // Assert
    expect(entries.filter((entry) => entry.source === '' || entry.catalogName === '')).toEqual([])
  })

  it.skipIf(!isJamPresent)(
    'maps every piece of the game catalogue, in its order, or lists it as a gap',
    () => {
      // Arrange
      const catalog = readCatalog()
      const getMissing = (names: readonly string[], mapped: readonly { catalogName: string }[]) =>
        names.filter(
          (name, index) =>
            mapped[index]?.catalogName !== name && !DRIVER_CATALOGUE_GAPS.includes(name)
        )

      // Act
      const missing = [
        ...getMissing(
          catalog.hats.map((hat) => hat.name.replace('.', '')),
          LDRAW_HATS
        ),
        ...getMissing(
          catalog.heads.entries.map((head) => head.name),
          LDRAW_FACES
        ),
        ...getMissing(
          catalog.torsos.entries.map((torso) => torso.name),
          LDRAW_TORSOS
        ),
        ...getMissing(
          catalog.legs.entries.map((legs) => legs.name),
          LDRAW_LEGS
        ),
      ]

      // Assert
      expect(missing).toEqual([])
    }
  )

  it.skipIf(!isJamPresent)(
    'gives a hook hand to exactly the torsos the catalogue types as hook torsos',
    () => {
      // Arrange
      const catalog = readCatalog()

      // Act
      const hookTorsos = [
        catalog.torsos.entries
          .filter((torso) => torso.type === HOOK_TORSO_TYPE)
          .map((torso) => torso.name),
        LDRAW_TORSOS.filter((torso) => torso.isHookHand).map((torso) => torso.catalogName),
      ]

      // Assert
      expect(hookTorsos[1]).toEqual(hookTorsos[0])
    }
  )

  it.skipIf(!isLibraryPresent)('names parts the LDraw library has', () => {
    // Arrange
    const files = new Set(readdirSync(LIBRARY_PARTS))
    const parts = [
      ...LDRAW_HATS.flatMap((entry) => entry.hats.map((hat) => hat.part)),
      ...LDRAW_FACES.map((entry) => entry.part),
      ...LDRAW_TORSOS.map((entry) => entry.part),
      ...LDRAW_LEGS.flatMap((entry) => [entry.leftLeg.part, entry.rightLeg.part]),
    ]

    // Act
    const missing = parts.filter((part) => !files.has(`${part}.dat`))

    // Assert
    expect(missing).toEqual([])
  })
})
