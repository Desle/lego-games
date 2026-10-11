import { openJamArchive } from '../../../jam-archive/index.ts'
import { parseMaterialLibrary } from '../../../material/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import {
  loadSavedCars,
  DEFAULT_SAVE_PATH,
  BRICK_DATABASE_PATH,
} from '../load-saved-cars/load-saved-cars.ts'
import {
  getBrickColorMaterialIndices,
  parseBrickColors,
} from '../parse-brick-colors/parse-brick-colors.ts'
import { parseBrickDatabase } from '../parse-brick-database/parse-brick-database.ts'
import { buildCarGeometry } from './build-car-geometry.ts'

const isPresent = getIsOriginalJamPresent()

describe.skipIf(!isPresent)('buildCarGeometry on the default car', () => {
  const archive = isPresent ? openJamArchive(readOriginalJam()) : null
  const readFile = (path: string): Uint8Array => {
    if (archive === null) throw new Error('The original files are missing')
    return archive.readFile(path)
  }
  const build = () => {
    const [car] = loadSavedCars(readFile, DEFAULT_SAVE_PATH)
    if (car?.design === undefined || car.design === null) throw new Error('No design')
    const colors = parseBrickColors(readFile('MENUDATA\\PIECEDB\\L_COLORS.LEB'))
    const materialNames = parseMaterialLibrary(
      readFile('MENUDATA\\PIECEDB\\LPIECELO.MDB')
    ).materials.map((material) => material.name)
    const database = parseBrickDatabase(readFile(BRICK_DATABASE_PATH))
    return {
      geometry: buildCarGeometry(
        database,
        car.design,
        getBrickColorMaterialIndices(colors, materialNames)
      ),
      materialCount: materialNames.length,
    }
  }

  it('makes triangles of every batch from vertices it holds, drawn with materials of the library', () => {
    // Arrange / Act
    const { geometry, materialCount } = build()

    // Assert
    const vertexCount = geometry.positions.length / 3
    expect(vertexCount).toBeGreaterThan(100)
    expect(geometry.normals).toHaveLength(geometry.positions.length)
    expect(geometry.textureCoordinates).toHaveLength(vertexCount * 2)
    for (const batch of geometry.batches) {
      expect(batch.materialIndex).toBeGreaterThanOrEqual(0)
      expect(batch.materialIndex).toBeLessThan(materialCount)
      expect(batch.vertexIndices.length % 3).toBe(0)
      expect(Math.max(...batch.vertexIndices)).toBeLessThan(vertexCount)
    }
  })

  it('puts the car on its chassis origin: about nine studs long, and around z = 0', () => {
    // Arrange / Act
    const { geometry } = build()

    // Assert
    const zs = geometry.positions.filter((_value, index) => index % 3 === 2)
    const xs = geometry.positions.filter((_value, index) => index % 3 === 0)
    expect(Math.min(...zs)).toBeGreaterThan(-3)
    expect(Math.max(...zs)).toBeLessThan(10)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(6)
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(12)
  })
})
