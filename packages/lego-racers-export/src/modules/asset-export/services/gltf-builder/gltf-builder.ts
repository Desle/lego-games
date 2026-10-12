import type {
  GltfAccessorSource,
  GltfAccessorType,
  GltfAttributeArray,
  GltfBuilder,
  GltfBufferTarget,
  GltfMaterialSource,
} from './gltf-builder.types.ts'

const COMPONENT_TYPE_FLOAT = 5126
const COMPONENT_TYPE_UNSIGNED_BYTE = 5121
const COMPONENT_TYPE_UNSIGNED_SHORT = 5123
const COMPONENT_TYPE_UNSIGNED_INT = 5125
const TARGET_VERTICES = 34962
const TARGET_INDICES = 34963
const ALIGNMENT = 4

const COMPONENT_COUNTS: Readonly<Record<GltfAccessorType, number>> = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
})

const getComponentType = (values: GltfAttributeArray): number => {
  if (values instanceof Float32Array) return COMPONENT_TYPE_FLOAT
  if (values instanceof Uint8Array) return COMPONENT_TYPE_UNSIGNED_BYTE
  if (values instanceof Uint16Array) return COMPONENT_TYPE_UNSIGNED_SHORT
  return COMPONENT_TYPE_UNSIGNED_INT
}

const getTarget = (target: GltfBufferTarget): number | undefined => {
  if (target === 'vertices') return TARGET_VERTICES
  if (target === 'indices') return TARGET_INDICES
  return undefined
}

const getBounds = (values: GltfAttributeArray, componentCount: number) => {
  const minimum = Array.from({ length: componentCount }, () => Infinity)
  const maximum = Array.from({ length: componentCount }, () => -Infinity)
  for (const [index, value] of values.entries()) {
    const component = index % componentCount
    minimum[component] = Math.min(minimum[component] ?? Infinity, value)
    maximum[component] = Math.max(maximum[component] ?? -Infinity, value)
  }
  return { min: minimum, max: maximum }
}

const getPadded = (bytes: Uint8Array): Uint8Array => {
  const padded = new Uint8Array(Math.ceil(bytes.length / ALIGNMENT) * ALIGNMENT)
  padded.set(bytes)
  return padded
}

const getMaterialJson = (source: GltfMaterialSource) => ({
  name: source.name,
  pbrMetallicRoughness: {
    baseColorFactor: source.baseColorFactor,
    ...(source.baseColorTexture === null
      ? {}
      : { baseColorTexture: { index: source.baseColorTexture } }),
    metallicFactor: 0,
    roughnessFactor: 1,
  },
  alphaMode: source.alphaMode,
  ...(source.alphaMode === 'MASK' ? { alphaCutoff: source.alphaCutoff } : {}),
})

// Collects glTF 2.0 parts and one binary buffer; every `add` returns the index of what it added.
export const createGltfBuilder = (): GltfBuilder => {
  const chunks: Uint8Array[] = []
  let byteLength = 0
  const accessors: object[] = []
  const bufferViews: object[] = []
  const images: object[] = []
  const samplers: object[] = []
  const textures: object[] = []
  const materials: object[] = []
  const meshes: object[] = []
  const nodes: object[] = []
  const skins: object[] = []
  const animations: object[] = []
  const scenes: object[] = []
  const addAccessor = (source: GltfAccessorSource): number => {
    const bytes = new Uint8Array(
      source.values.buffer,
      source.values.byteOffset,
      source.values.byteLength
    )
    const componentCount = COMPONENT_COUNTS[source.type]
    const target = getTarget(source.target)
    bufferViews.push({
      buffer: 0,
      byteOffset: byteLength,
      byteLength: bytes.length,
      ...(target === undefined ? {} : { target }),
    })
    chunks.push(getPadded(bytes))
    byteLength += Math.ceil(bytes.length / ALIGNMENT) * ALIGNMENT
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: getComponentType(source.values),
      count: source.values.length / componentCount,
      type: source.type,
      ...(source.isNormalized ? { normalized: true } : {}),
      ...(source.isBounded ? getBounds(source.values, componentCount) : {}),
    })
    return accessors.length - 1
  }
  const add = (list: object[], item: object): number => {
    list.push(item)
    return list.length - 1
  }
  const build = (binaryUri: string) => {
    const document = {
      asset: { version: '2.0', generator: 'lego-racers-export' },
      scene: 0,
      scenes,
      nodes,
      meshes,
      materials,
      textures,
      images,
      samplers,
      skins,
      animations,
      accessors,
      bufferViews,
      buffers: [{ uri: binaryUri, byteLength }],
    }
    // glTF forbids empty arrays.
    const populated = Object.fromEntries(
      Object.entries(document).filter(([, value]) => !Array.isArray(value) || value.length > 0)
    )
    const binary = new Uint8Array(byteLength)
    let offset = 0
    for (const chunk of chunks) {
      binary.set(chunk, offset)
      offset += chunk.length
    }
    return { json: JSON.stringify(populated), binary }
  }
  return Object.freeze({
    addAccessor,
    addImage: (uri) => add(images, { uri }),
    addSampler: (source) =>
      add(samplers, {
        magFilter: source.magnificationFilter,
        minFilter: source.minificationFilter,
        wrapS: source.wrapS,
        wrapT: source.wrapT,
      }),
    addTexture: (imageIndex, samplerIndex) =>
      add(textures, { source: imageIndex, sampler: samplerIndex }),
    addMaterial: (source) => add(materials, getMaterialJson(source)),
    addMesh: (name, primitives) => add(meshes, { name, primitives }),
    addNode: (source) => add(nodes, source),
    getNodeCount: () => nodes.length,
    addSkin: (source) => add(skins, source),
    addAnimation: (source) => {
      const samplersOfAnimation = source.channels.map((channel) => ({
        input: channel.input,
        output: channel.output,
        interpolation: 'LINEAR',
      }))
      animations.push({
        name: source.name,
        samplers: samplersOfAnimation,
        channels: source.channels.map((channel, index) => ({
          sampler: index,
          target: { node: channel.node, path: channel.path },
        })),
      })
    },
    addScene: (name, sceneNodes) => add(scenes, { name, nodes: sceneNodes }),
    build,
  })
}
