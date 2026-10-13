import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseAnimation } from '@lego-games/lego-racers/animation'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import {
  getBoneMatrices,
  getRestPose,
  getSkeletalAnimation,
} from '@lego-games/lego-racers/skeletal-animation'
import { parseSkeleton } from '@lego-games/lego-racers/skeleton'
import { buildModelGltf } from './build-model-gltf.ts'

const JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isOriginalPresent = existsSync(JAM_PATH)

type GltfNode = {
  children?: number[]
  translation?: [number, number, number]
  rotation?: [number, number, number, number]
  scale?: number[]
}
type GltfJson = {
  nodes: GltfNode[]
  meshes: { primitives: { attributes: Record<string, number> }[] }[]
  skins?: { joints: number[]; inverseBindMatrices: number }[]
  accessors: { count: number }[]
}

// Column-major 4x4 of a node's translation and rotation.
const getLocalMatrix = (node: GltfNode): number[] => {
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1]
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y + z * w),
    2 * (x * z - y * w),
    0,
    2 * (x * y - z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z + x * w),
    0,
    2 * (x * z + y * w),
    2 * (y * z - x * w),
    1 - 2 * (x * x + y * y),
    0,
    tx,
    ty,
    tz,
    1,
  ]
}

const getProduct = (left: number[], right: number[]): number[] =>
  Array.from({ length: 16 }, (_unused, entry) => {
    const column = Math.floor(entry / 4)
    const row = entry % 4
    return [0, 1, 2, 3].reduce(
      (sum, inner) => sum + (left[inner * 4 + row] ?? 0) * (right[column * 4 + inner] ?? 0),
      0
    )
  })

describe.runIf(isOriginalPresent)('buildModelGltf on the original LEGO.JAM', () => {
  const archive = isOriginalPresent ? openJamArchive(new Uint8Array(readFileSync(JAM_PATH))) : null
  const getTextureUri = () => null

  it('places the skeleton nodes so that their world matrices are the engine bone matrices at rest', () => {
    // Arrange
    if (archive === null) return
    const directory = 'MENUDATA\\PIECEDB'
    const { scene, meshScales } = loadModelScene(archive, {
      directory,
      textureNames: ['DAJMW'],
      materialNames: ['DAJMW'],
      meshNames: ['DAJMW'],
      skeletonName: null,
      animationName: null,
    })
    const skeleton = parseSkeleton(archive.readFile(`${directory}\\DAJMW.SDB`))
    const animation = getSkeletalAnimation(
      parseAnimation(archive.readFile(`${directory}\\DAJMW.ADB`))
    )

    // Act
    const output = buildModelGltf({
      name: 'DAJMW',
      scene,
      meshIndex: 0,
      scale: meshScales[0] ?? 1,
      skeleton,
      animation,
      getTextureUri,
      binaryUri: 'DAJMW.bin',
    })

    // Assert
    const gltf = JSON.parse(output.json) as GltfJson
    const joints = gltf.skins?.[0]?.joints ?? []
    const parentOf = new Map<number, number>()
    for (const [index, node] of gltf.nodes.entries()) {
      for (const child of node.children ?? []) parentOf.set(child, index)
    }
    const getWorld = (nodeIndex: number): number[] => {
      const local = getLocalMatrix(gltf.nodes[nodeIndex] ?? {})
      const parent = parentOf.get(nodeIndex)
      return parent === undefined || !joints.includes(parent)
        ? local
        : getProduct(getWorld(parent), local)
    }
    const engineMatrices = getBoneMatrices(skeleton, getRestPose(skeleton))
    expect(joints).toHaveLength(skeleton.bones.length)
    for (const [boneIndex, nodeIndex] of joints.entries()) {
      const world = getWorld(nodeIndex)
      for (let entry = 0; entry < 16; entry++) {
        expect(world[entry]).toBeCloseTo(engineMatrices[boneIndex * 16 + entry] ?? 0, 4)
      }
    }
    expect(gltf.meshes[0]?.primitives[0]?.attributes).toHaveProperty('JOINTS_0')
  })

  it('writes positions, texture coordinates and normals of a model without a skeleton', () => {
    // Arrange
    if (archive === null) return
    const { scene } = loadModelScene(archive, {
      directory: 'GAMEDATA\\COMMON',
      textureNames: ['RRCM'],
      materialNames: ['RRCM'],
      meshNames: ['RRCM'],
      skeletonName: null,
      animationName: null,
    })

    // Act
    const output = buildModelGltf({
      name: 'RRCM',
      scene,
      meshIndex: 0,
      scale: 1,
      skeleton: null,
      animation: null,
      getTextureUri,
      binaryUri: join('RRCM.bin'),
    })

    // Assert
    const gltf = JSON.parse(output.json) as GltfJson
    const attributes = gltf.meshes[0]?.primitives[0]?.attributes ?? {}
    expect(Object.keys(attributes)).toEqual(expect.arrayContaining(['POSITION', 'TEXCOORD_0']))
    expect(gltf.skins).toBeUndefined()
  })
})
