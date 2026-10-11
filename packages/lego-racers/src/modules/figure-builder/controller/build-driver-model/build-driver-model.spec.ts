import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseModel } from '../../../model/index.ts'
import { parseBodyPartCatalog } from '../parse-body-part-catalog/parse-body-part-catalog.ts'
import { parsePartGeometry } from '../parse-part-geometry/parse-part-geometry.ts'
import { buildDriverModel } from './build-driver-model.ts'

const JAM_PATH = new URL(
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM',
  import.meta.url
)
const isAvailable = existsSync(JAM_PATH)

describe.skipIf(!isAvailable)('buildDriverModel', () => {
  it('lists the catalogue of the game', () => {
    // Arrange
    const archive = openJamArchive(new Uint8Array(readFileSync(JAM_PATH)))
    // Act
    const catalog = parseBodyPartCatalog(archive.readFile('MENUDATA\\PARTDB\\BODYPART.PCB'))
    // Assert
    expect([
      catalog.hats.length,
      catalog.heads.entries.length,
      catalog.torsos.entries.length,
      catalog.legs.entries.length,
    ]).toEqual([36, 30, 29, 20])
  })

  it('replaces the face, torso and legs materials and adds the hat', () => {
    // Arrange
    const archive = openJamArchive(new Uint8Array(readFileSync(JAM_PATH)))
    const catalog = parseBodyPartCatalog(archive.readFile('MENUDATA\\PARTDB\\BODYPART.PCB'))
    const geometry = parsePartGeometry(archive.readFile('MENUDATA\\PARTDB\\GAMEPART\\ICB_CHAR.GCB'))
    const body = parseModel(archive.readFile('MENUDATA\\PARTDB\\GAMEPART\\LEG_BOX.GDB'))
    // Act
    const model = buildDriverModel({ catalog, geometry, body, partBytes: [2, 22, 25, 5, 0] })
    // Assert
    expect(model.batches.map((batch) => batch.materialName)).toEqual([
      'leg_dgbk',
      'bk_chst',
      'lg_dflt',
      'helmet2',
    ])
  })

  it("puts the texture the right way up: the bat helmet's face patch lies in the middle of the face texture", () => {
    // Arrange
    const archive = openJamArchive(new Uint8Array(readFileSync(JAM_PATH)))
    const geometry = parsePartGeometry(archive.readFile('MENUDATA\\PARTDB\\GAMEPART\\ICB_CHAR.GCB'))
    const batHat = geometry.parts.find((part) => part.name === 'bb_hat')
    const faceGroup = batHat?.groups.find((group) => group.materialName === 'face')

    // Act
    const verticalCoordinates = Array.from(
      faceGroup?.triangles ?? [],
      (index) => geometry.textureCoordinates[index * 2 + 1] ?? 0
    )

    // Assert
    expect(Math.min(...verticalCoordinates)).toBeCloseTo(1 - 0.655, 2)
    expect(Math.max(...verticalCoordinates)).toBeCloseTo(1 - 0.425, 2)
  })
})
