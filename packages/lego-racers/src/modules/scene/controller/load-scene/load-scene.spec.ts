import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import type { JamArchive } from '../../../jam-archive/index.ts'
import { getRaceWorldPaths } from '../../types/race-world-paths/race-world-paths.ts'
import { SceneInstanceKind } from '../../types/scene-enums/scene-enums.ts'
import { SceneLinkError } from '../../types/scene-errors/scene-errors.ts'
import { getWorldPaths, loadScene } from './load-scene.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isOriginalPresent = existsSync(ORIGINAL_JAM_PATH)

// Royal Knights Raceway, the first race, as its RACEC0R0.RAB names its worlds.
const FIRST_RACE_WORLDS = {
  globalWorld: 'global.wdf',
  trackWorld: 'rrtrk.wdf',
  collisionWorld: 'collide.wdf',
  blendedWorld: 'blended.wdf',
  localWorld: 'local.wdf',
}

const getTriangleCount = (archive: JamArchive, worldPaths: readonly string[]) =>
  loadScene(archive, worldPaths).meshes.reduce(
    (sum, mesh) =>
      sum + mesh.drawBatches.reduce((count, batch) => count + batch.vertexIndices.length / 3, 0),
    0
  )

describe.runIf(isOriginalPresent)('loadScene on the original LEGO.JAM', () => {
  const archive = isOriginalPresent
    ? openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
    : null

  it('links the first race track into meshes, materials, textures and instances', () => {
    // Arrange
    const worldPaths = getRaceWorldPaths('GAMEDATA\\RACEC0R0', FIRST_RACE_WORLDS)

    // Act
    const scene = loadScene(archive!, worldPaths)

    // Assert
    expect(scene.worldPaths).toEqual(worldPaths)
    expect(scene.instances.length).toBeGreaterThan(10)
    expect(scene.instances.some((instance) => instance.kind === SceneInstanceKind.BSP_TREE)).toBe(
      true
    )
    expect(scene.cameras.length).toBeGreaterThan(0)
    const track = scene.textures.filter((texture) => texture.bitmap !== null)
    expect(track.length).toBeGreaterThan(20)
    for (const texture of track) {
      expect(texture.bitmap!.colors).toHaveLength(
        texture.bitmap!.width * texture.bitmap!.height * 4
      )
    }
    for (const instance of scene.instances) {
      for (const level of instance.levels) {
        if (level.meshIndex >= 0) expect(scene.meshes[level.meshIndex]).toBeDefined()
      }
    }
    for (const mesh of scene.meshes) {
      for (const batch of mesh.drawBatches) {
        expect(mesh.materialIndices[batch.materialSlot]).toBeDefined()
        expect(Math.max(...batch.vertexIndices)).toBeLessThan(mesh.vertexCount)
      }
    }
  })

  it('links the BSP tree instance to its tree and keeps the first command of every draw batch', () => {
    // Arrange
    const worldPaths = getRaceWorldPaths('GAMEDATA\\RACEC0R0', FIRST_RACE_WORLDS)

    // Act
    const scene = loadScene(archive!, worldPaths)

    // Assert
    const track = scene.instances.find((instance) => instance.kind === SceneInstanceKind.BSP_TREE)
    const tree = scene.bspTrees[track?.levels[0]?.bspTreeIndex ?? -1]
    expect(tree?.path).toBe('GAMEDATA\\RACEC0R0\\RKTK.BDB')
    expect(tree?.tree.nodes.length).toBe(77)
    const mesh = scene.meshes[track?.levels[0]?.meshIndex ?? -1]
    const firstCommands = mesh?.drawBatches.map((batch) => batch.firstCommand) ?? []
    expect(firstCommands[0]).toBe(0)
    expect(firstCommands).toEqual([...firstCommands].sort((first, second) => first - second))
  })

  it('links skeleton instances to their skeletons, animations and starting clip', () => {
    // Arrange
    const worldPaths = getRaceWorldPaths('GAMEDATA\\RACEC0R0', FIRST_RACE_WORLDS)

    // Act
    const scene = loadScene(archive!, worldPaths)

    // Assert
    const hammer = scene.instances.find((instance) => instance.name === 'rkhamm02')
    const cameraDummy = scene.instances.find((instance) => instance.name === 'camDUM')
    expect(hammer?.kind).toBe(SceneInstanceKind.SKELETON)
    expect(hammer?.worldPath).toBe('GAMEDATA\\RACEC0R0\\RRTRK.WDB')
    expect(hammer?.startClipIndex).toBe(0)
    const skeletonIndex = hammer?.levels[0]?.skeletonIndex ?? -1
    expect(scene.skeletons[skeletonIndex]?.name).toBe('rkhamm02')
    expect(scene.animations[hammer?.levels[0]?.animationIndex ?? -1]?.name).toBe('rkhamm02')
    expect(cameraDummy?.levels[0]?.meshIndex).toBe(-1)
  })

  it('opens every texture database, library and model the track names from the race directory', () => {
    // Arrange
    const trackPath = 'GAMEDATA\\RACEC0R0\\RRTRK.WDB'

    // Act
    const scene = loadScene(archive!, [trackPath])

    // Assert
    expect(scene.meshes.every((mesh) => mesh.path.startsWith('GAMEDATA\\RACEC0R0\\'))).toBe(true)
    expect(scene.materials.every((material) => material.libraryPath.endsWith('.MDB'))).toBe(true)
    expect(getTriangleCount(archive!, [trackPath])).toBe(5020)
  })

  it('fails like the original when a world needs materials an earlier world defines', () => {
    // Arrange
    const blendedPath = 'GAMEDATA\\RACEC0R2\\BLENDED.WDB'

    // Act
    const load = () => loadScene(archive!, [blendedPath])

    // Assert
    expect(load).toThrow(SceneLinkError)
    expect(load).toThrow('adcrs01: Material assignment failed')
  })

  it('loads every race of the game with its worlds in race order', () => {
    // Arrange
    const raceDirectories = getWorldPaths(archive!)
      .filter((path) => /^GAMEDATA\\RACEC\dR\d\\/.test(path))
      .map((path) => path.slice(0, path.lastIndexOf('\\')))

    // Act
    const loads = [...new Set(raceDirectories)].map((directory) => () => {
      const trackPath = getWorldPaths(archive!).find(
        (path) =>
          path.startsWith(`${directory}\\`) && !/\\(COLLIDE|BLENDED|LOCAL|BACKGRD)\.WDB$/.test(path)
      )
      const trackName = trackPath?.slice(directory.length + 1) ?? ''
      return loadScene(
        archive!,
        getRaceWorldPaths(directory, { ...FIRST_RACE_WORLDS, trackWorld: trackName })
      )
    })

    // Assert
    expect(loads).toHaveLength(13)
    for (const load of loads) expect(load).not.toThrow()
  })
})
