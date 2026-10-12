export {
  getEmitterBasis,
  getEmitterVelocity,
  IDENTITY_EMITTER_BASIS,
} from './controller/emitter-basis/emitter-basis.ts'
export {
  createEmitterPool,
  EMITTER_HANDLE_COUNT,
  getEmitterBornCount,
  getHasEmitterDefinition,
  NO_EMITTER_POOLS,
  getIsEmitterHandleLive,
  releaseAllEmitters,
  releaseEmitter,
  releaseEmitterImmediately,
  setEmitterOrientation,
  setEmitterPosition,
  setEmitterVelocityOffset,
  spawnEmitter,
  updateEmitterPool,
} from './controller/emitter-pool/emitter-pool.ts'
export {
  getBillboardAxes,
  getEmitterQuads,
  QUAD_TRIANGLE_CORNERS,
} from './controller/emitter-quads/emitter-quads.ts'
export { PARTICLE_CAPACITY } from './controller/emitter-system/emitter-system.ts'
export { parseEmitters } from './controller/parse-emitters/parse-emitters.ts'
export { EmitterKeyword } from './types/emitter-keyword/emitter-keyword.ts'
export type {
  EmitterHandle,
  EmitterInstance,
  EmitterPlacement,
  EmitterPool,
  EmitterPools,
  EmitterReference,
  EmitterPoolInput,
  EmitterRandom,
  EmitterSpawn,
  EmitterSystem,
  EmitterUpdate,
  Particle,
} from './types/emitter-pool.types.ts'
export type { BillboardAxes, EmitterQuad, EmitterQuadCorner } from './types/emitter-quad.types.ts'
export type { Emitter, EmitterList, Vector3 } from './types/emitter.types.ts'
