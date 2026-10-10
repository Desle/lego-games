import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { encodeArrayHeader, encodeFloat } from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { getSegmentQueryResult } from '../../types/segment-query/segment-query.ts'
import { loadCollisionObject } from './load-collision-object.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const point = (x: number, y: number, z: number): Vector3 => ({ x, y, z })

// One 0x34 vector list with a vertex at y = 2.
const BVB_WITH_ONE_VERTEX = new Uint8Array([
  0x34,
  ...encodeArrayHeader(1),
  ...[1, 2, 3].flatMap(encodeFloat),
  0x06,
])

describe('loadCollisionObject', () => {
  it('parses the volume, mirrors it for a mirrored race and puts it at the origin', () => {
    // Arrange
    const source = { bytes: BVB_WITH_ONE_VERTEX, frame: undefined }

    // Act
    const plain = loadCollisionObject({ ...source, isMirrored: false })
    const mirrored = loadCollisionObject({ ...source, isMirrored: true })

    // Assert
    expect(plain.volume.vertices).toEqual([{ x: 1, y: 2, z: 3 }])
    expect(mirrored.volume.vertices).toEqual([{ x: 1, y: -2, z: 3 }])
    expect(plain.frame.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'finds every flat triangle of the first race track from just above or below its centre',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const { volume } = loadCollisionObject({
        bytes: archive.readFile('GAMEDATA\\RACEC0R0\\COLLIDE.BVB'),
        isMirrored: false,
        frame: undefined,
      })
      const getVertex = (index: number): Vector3 => volume.vertices[index] ?? point(0, 0, 0)
      const flatTriangleCentres = volume.triangles.flatMap((triangle) => {
        const [first, second, third] = triangle.vertexIndices.map(getVertex)
        if (first === undefined || second === undefined || third === undefined) return []
        const isFlat = first.z === second.z && second.z === third.z
        const area =
          (third.x - second.x) * (first.y - second.y) - (third.y - second.y) * (first.x - second.x)
        if (!isFlat || area === 0) return []
        return [
          point(
            Math.fround((first.x + second.x + third.x) / 3),
            Math.fround((first.y + second.y + third.y) / 3),
            first.z
          ),
        ]
      })

      // Act
      const hitHeights = flatTriangleCentres.map(
        (centre) =>
          getSegmentQueryResult(
            SINGLE,
            volume,
            point(centre.x, centre.y, Math.fround(centre.z + 0.5)),
            point(centre.x, centre.y, Math.fround(centre.z - 0.5))
          ).intersection?.point.z
      )

      // Assert
      expect(flatTriangleCentres.length).toBeGreaterThan(50)
      for (const [index, height] of hitHeights.entries()) {
        const error = Math.abs((height ?? Infinity) - (flatTriangleCentres[index]?.z ?? 0))
        expect({ index, isOnTriangle: error < 0.001 }).toEqual({ index, isOnTriangle: true })
      }
    }
  )
})
