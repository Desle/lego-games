import type { Object3D } from 'three'

export type ShaderPrecompiler = (object: Object3D) => Promise<void>
