export type GltfVector3 = readonly [number, number, number]
export type GltfQuaternion = readonly [number, number, number, number]

export type GltfAttributeArray = Float32Array | Uint8Array | Uint16Array | Uint32Array

export type GltfAccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4'

export type GltfBufferTarget = 'vertices' | 'indices' | 'none'

export type GltfAccessorSource = {
  readonly values: GltfAttributeArray
  readonly type: GltfAccessorType
  readonly target: GltfBufferTarget
  readonly isNormalized: boolean
  // The glTF specification requires min and max on POSITION accessors and on animation inputs.
  readonly isBounded: boolean
}

export type GltfPrimitive = {
  readonly attributes: Readonly<Record<string, number>>
  readonly indices: number
  readonly material: number
}

export type GltfSamplerSource = {
  readonly magnificationFilter: number
  readonly minificationFilter: number
  readonly wrapS: number
  readonly wrapT: number
}

export type GltfMaterialSource = {
  readonly name: string
  readonly baseColorFactor: readonly [number, number, number, number]
  readonly baseColorTexture: number | null
  readonly alphaMode: 'OPAQUE' | 'MASK' | 'BLEND'
  readonly alphaCutoff: number
}

export type GltfNodeSource = {
  readonly name: string
  readonly children?: readonly number[]
  readonly mesh?: number
  readonly skin?: number
  readonly translation?: GltfVector3
  readonly rotation?: GltfQuaternion
  readonly scale?: GltfVector3
}

export type GltfSkinSource = {
  readonly name: string
  readonly joints: readonly number[]
  readonly inverseBindMatrices: number
}

export type GltfAnimationChannelSource = {
  readonly node: number
  readonly path: 'translation' | 'rotation'
  // Accessor of the key times.
  readonly input: number
  // Accessor of the key values.
  readonly output: number
}

export type GltfAnimationSource = {
  readonly name: string
  readonly channels: readonly GltfAnimationChannelSource[]
}

export type GltfOutput = {
  readonly json: string
  readonly binary: Uint8Array
}

export type GltfBuilder = {
  readonly addAccessor: (source: GltfAccessorSource) => number
  readonly addImage: (uri: string) => number
  readonly addSampler: (source: GltfSamplerSource) => number
  readonly addTexture: (imageIndex: number, samplerIndex: number) => number
  readonly addMaterial: (source: GltfMaterialSource) => number
  readonly addMesh: (name: string, primitives: readonly GltfPrimitive[]) => number
  readonly addNode: (source: GltfNodeSource) => number
  // The index the next added node gets, for a parent that lists children added after it.
  readonly getNodeCount: () => number
  readonly addSkin: (source: GltfSkinSource) => number
  readonly addAnimation: (source: GltfAnimationSource) => void
  readonly addScene: (name: string, nodes: readonly number[]) => number
  readonly build: (binaryUri: string) => GltfOutput
}
