import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { loadModelScene } from './load-model-scene.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isOriginalPresent = existsSync(ORIGINAL_JAM_PATH)

describe.runIf(isOriginalPresent)('loadModelScene on the original LEGO.JAM', () => {
  const archive = isOriginalPresent
    ? openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
    : null

  it('loads a car and its driver as two mesh instances with their materials and scales', () => {
    // Arrange
    if (archive === null) return

    // Act
    const { scene, meshScales } = loadModelScene(archive, {
      directory: 'GAMEDATA\\COMMON',
      textureNames: ['RRCM', 'RRPELVIS'],
      materialNames: ['RRCM', 'RRPELVIS'],
      meshNames: ['RRCM', 'RRPELVIS'],
    })

    // Assert
    expect(scene.instances.map((instance) => instance.name)).toEqual(['RRCM', 'RRPELVIS'])
    expect(scene.meshes[0]?.vertexCount).toBe(444)
    expect(meshScales[0]).toBeCloseTo(0.007849, 6)
    expect(meshScales[1]).toBe(0.015625)
    expect(scene.textures.every((texture) => texture.bitmap !== null)).toBe(true)
  })
})
