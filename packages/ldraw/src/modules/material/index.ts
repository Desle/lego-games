export { getLookNeedsOcclusion } from './services/ldraw-look/ldraw-look-shader.ts'
export {
  LOOK_APPEARANCES,
  LOOK_PARAMETER,
  getActiveLook,
  getIsLookEncoded,
  getLookLabels,
  getLookPreset,
  getLookPresetFromLabel,
  setActiveLookPreset,
  useLookFromAddress,
} from './services/ldraw-look/ldraw-look.ts'
export {
  LookEdges,
  LookPreset,
  LookShading,
  MaterialCategory,
} from './services/ldraw-look/ldraw-look.types.ts'
export type { LookAppearance } from './services/ldraw-look/ldraw-look.types.ts'
export {
  bakeOcclusionGrid,
  createOcclusionVolume,
} from './services/ldraw-occlusion/ldraw-occlusion.ts'
export type {
  OcclusionGrid,
  OcclusionVolume,
} from './services/ldraw-occlusion/ldraw-occlusion.types.ts'
export {
  applyPlasticLook,
  createPlasticMaterialFromColor,
  createPlasticMaterialFromTexture,
  createStudioLights,
} from './services/ldraw-plastic/ldraw-plastic.ts'
export type { PlasticMesh } from './services/ldraw-plastic/ldraw-plastic.types.ts'
export {
  precompileShaders,
  setShaderPrecompiler,
} from './services/shader-precompiler/shader-precompiler.ts'
