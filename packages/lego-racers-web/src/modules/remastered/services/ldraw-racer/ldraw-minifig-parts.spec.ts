import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { parseBodyPartCatalog } from '@lego-games/lego-racers/figure-builder'
import { LDRAW_FACES, LDRAW_HATS, LDRAW_LEGS, LDRAW_TORSOS } from './ldraw-minifig-parts.ts'

const JAM_PATH = join(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const LIBRARY_PARTS = join(homedir(), 'ldraw', 'parts')
const isJamPresent = existsSync(JAM_PATH)
const isLibraryPresent = existsSync(LIBRARY_PARTS)
const CATALOG_PATH = 'MENUDATA\\PARTDB\\BODYPART.PCB'

describe('the library parts of the catalogue', () => {
  it('has a place for each hat, face, torso and pair of legs, the first hat being none', () => {
    // Arrange / Act
    const sizes = [LDRAW_HATS.length, LDRAW_FACES.length, LDRAW_TORSOS.length, LDRAW_LEGS.length]

    // Assert
    expect([sizes, LDRAW_HATS[0]?.hats]).toEqual([[36, 30, 29, 20], []])
  })

  it('says why each entry stands for its part', () => {
    // Arrange / Act
    const entries = [...LDRAW_HATS, ...LDRAW_FACES, ...LDRAW_TORSOS, ...LDRAW_LEGS]

    // Assert
    expect(entries.filter((entry) => entry.source === '' || entry.catalogName === '')).toEqual([])
  })

  it.skipIf(!isJamPresent)('is in the order of the game catalogue', () => {
    // Arrange
    const catalog = parseBodyPartCatalog(
      openJamArchive(new Uint8Array(readFileSync(JAM_PATH))).readFile(CATALOG_PATH)
    )

    // Act
    const names = [
      catalog.hats.map((hat) => hat.name.replace('.', '')),
      catalog.heads.entries.map((head) => head.name),
      catalog.torsos.entries.map((torso) => torso.name),
      catalog.legs.entries.map((legs) => legs.name),
    ]

    // Assert
    expect(names).toEqual([
      LDRAW_HATS.map((entry) => entry.catalogName),
      LDRAW_FACES.map((entry) => entry.catalogName),
      LDRAW_TORSOS.map((entry) => entry.catalogName),
      LDRAW_LEGS.map((entry) => entry.catalogName),
    ])
  })

  it.skipIf(!isLibraryPresent)('names parts the LDraw library has', () => {
    // Arrange
    const files = new Set(readdirSync(LIBRARY_PARTS))
    const parts = [
      ...LDRAW_HATS.flatMap((entry) => entry.hats.map((hat) => hat.part)),
      ...LDRAW_FACES.map((entry) => entry.part),
      ...LDRAW_TORSOS.flatMap((entry) => (entry.print === null ? [] : [entry.print.part])),
      ...LDRAW_LEGS.flatMap((entry) => [entry.leftLeg.part, entry.rightLeg.part]),
    ]

    // Act
    const missing = parts.filter((part) => !files.has(`${part}.dat`))

    // Assert
    expect(missing).toEqual([])
  })
})
