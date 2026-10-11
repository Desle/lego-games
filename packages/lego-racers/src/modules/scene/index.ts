export { loadModelScene } from './controller/load-model-scene/load-model-scene.ts'
export type {
  ModelFiles,
  ModelScene,
} from './controller/load-model-scene/load-model-scene.types.ts'
export { getDrawBatches } from './types/draw-batches/draw-batches.ts'
export type { DrawCommand, DrawFace } from './types/draw-batches/draw-batches.types.ts'
export { loadGeometryScene } from './controller/load-geometry-scene/load-geometry-scene.ts'
export type {
  GeometryBatch,
  GeometryBones,
  GeometryFiles,
  ModelGeometry,
} from './controller/load-geometry-scene/load-geometry-scene.types.ts'
export { getWorldPaths, loadScene } from './controller/load-scene/load-scene.ts'
export {
  COMMON_DIRECTORY,
  getRaceBackgroundWorldPath,
  getRaceSkyPath,
  getRaceWorldPaths,
} from './types/race-world-paths/race-world-paths.ts'
export type {
  RaceSkyNames,
  RaceWorldNames,
} from './types/race-world-paths/race-world-paths.types.ts'
export {
  BlendFactor,
  CompareFunction,
  MissingBitmapReason,
  SceneInstanceKind,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from './types/scene-enums/scene-enums.ts'
export { SceneLinkError, ScenePathError } from './types/scene-errors/scene-errors.ts'
export type {
  Scene,
  SceneAmbientLight,
  SceneAnimation,
  SceneBitmap,
  SceneCamera,
  SceneDirectionalLight,
  SceneDrawBatch,
  SceneInstance,
  SceneInstanceLevel,
  SceneMaterial,
  SceneMaterialAssignment,
  SceneMesh,
  SceneRenderState,
  SceneRotation,
  SceneSkeleton,
  SceneTexture,
  SceneVector,
} from './types/scene.types.ts'
export type {
  BlendFactor as BlendFactorValue,
  CompareFunction as CompareFunctionValue,
  ShadeMode as ShadeModeValue,
  TextureOperation as TextureOperationValue,
} from './types/scene.types.ts'
export { getColorKeyPaletteIndex } from './types/texture-colors/texture-colors.ts'
