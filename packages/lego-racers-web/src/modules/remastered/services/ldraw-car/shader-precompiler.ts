import type { Object3D } from 'three'
import type { ShaderPrecompiler } from './shader-precompiler.types.ts'

let precompiler: ShaderPrecompiler | null = null

// The race says how to compile a model's shaders for its own scene (its lights, its camera) without drawing it.
export const setShaderPrecompiler = (next: ShaderPrecompiler | null) => {
  precompiler = next
}

// Compiles the shaders of a model that is about to join the scene, on the browser's own compile threads, so the first frame that draws
// it does not stall while the driver links the programs. Resolves at once when there is nothing to compile for (no race), and when
// the compile fails: the first draw then compiles as it always did.
export const precompileShaders = (object: Object3D): Promise<void> =>
  precompiler === null ? Promise.resolve() : precompiler(object).catch(() => undefined)
