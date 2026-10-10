import { createEnum } from '../../../../shared/types/enum.types.ts'

// D3DRENDERSTATE_SHADEMODE as GolDP.dll 0x1000a2c0 sets it: material flag 4 → Gouraud (2), else flat (1).
export const ShadeMode = createEnum({
  FLAT: 'flat',
  GOURAUD: 'gouraud',
})

// The stage-0 D3DTEXTUREOP values 0x1000a2c0 uses: SELECTARG1 (texture), SELECTARG2 (diffuse), MODULATE.
export const TextureOperation = createEnum({
  SELECT_TEXTURE: 'select_texture',
  SELECT_DIFFUSE: 'select_diffuse',
  MODULATE: 'modulate',
})

// D3DCMPFUNC, in the order of the material's alpha function index (table 0x10056540).
export const CompareFunction = createEnum({
  ALWAYS: 'always',
  EQUAL: 'equal',
  GREATER: 'greater',
  GREATER_EQUAL: 'greater_equal',
  LESS: 'less',
  LESS_EQUAL: 'less_equal',
  NEVER: 'never',
  NOT_EQUAL: 'not_equal',
})

// D3DBLEND, in the order of the material's blend factor index (table 0x1005658c).
export const BlendFactor = createEnum({
  ZERO: 'zero',
  ONE: 'one',
  SOURCE_COLOR: 'source_color',
  DESTINATION_COLOR: 'destination_color',
  INVERSE_SOURCE_COLOR: 'inverse_source_color',
  INVERSE_DESTINATION_COLOR: 'inverse_destination_color',
  SOURCE_ALPHA: 'source_alpha',
  DESTINATION_ALPHA: 'destination_alpha',
  INVERSE_SOURCE_ALPHA: 'inverse_source_alpha',
  INVERSE_DESTINATION_ALPHA: 'inverse_destination_alpha',
  SOURCE_ALPHA_SATURATE: 'source_alpha_saturate',
})

// D3DTSS_MAGFILTER/MINFILTER: LINEAR unless material flag 0x800 is set.
export const TextureFilter = createEnum({
  LINEAR: 'linear',
  POINT: 'point',
})

// D3DTSS_ADDRESS: CLAMP with material flag 0x10000, else WRAP.
export const TextureAddressing = createEnum({
  WRAP: 'wrap',
  CLAMP: 'clamp',
})

// Which world section an instance comes from (0x2e mesh instances, 0x2f skeleton instances, 0x30 BSP tree
// instances).
export const SceneInstanceKind = createEnum({
  MESH: 'mesh',
  SKELETON: 'skeleton',
  BSP_TREE: 'bsp_tree',
})

// Why a texture has no decoded bitmap.
export const MissingBitmapReason = createEnum({
  FILE_NOT_FOUND: 'file_not_found',
})
