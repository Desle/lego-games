import type { Material, WebGLProgramParametersWithUniforms } from 'three'
import type { PlasticLightingExtension } from './plastic-lighting.types.ts'

export const PLASTIC_DIRECT_LIGHT_DEFINE = 'PLASTIC_DIRECT_LIGHT'
const LIGHTING_SKIPPED_DEFINE = 'PLASTIC_LIGHTING_SKIPPED'

let activeExtension: PlasticLightingExtension | null = null

// The app sets this before its first plastic is compiled: a program keeps the extension it was compiled with.
export const setPlasticLightingExtension = (extension: PlasticLightingExtension | null) => {
  activeExtension = extension
}

const getDirectLightChunk = (extension: PlasticLightingExtension): string => `
#include <lights_fragment_end>
#define ${PLASTIC_DIRECT_LIGHT_DEFINE}
#ifdef ${LIGHTING_SKIPPED_DEFINE}
float plasticDirectLight = 1.0;
#else
float plasticDirectLight = clamp(${extension.directLightShare}, 0.0, 1.0);
#endif
reflectedLight.directDiffuse *= plasticDirectLight;
reflectedLight.directSpecular *= plasticDirectLight;
#ifdef USE_CLEARCOAT
clearcoatSpecularDirect *= plasticDirectLight;
#endif
#ifdef USE_SHEEN
sheenSpecularDirect *= plasticDirectLight;
#endif
`

const extendShader = (
  shader: WebGLProgramParametersWithUniforms,
  extension: PlasticLightingExtension
) => {
  Object.assign(shader.uniforms, extension.uniforms)
  Object.assign(shader, {
    vertexShader: shader.vertexShader
      .replace('#include <common>', `#include <common>\n${extension.vertexDeclarations}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${extension.vertexChunk}`),
    fragmentShader: shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${extension.fragmentDeclarations}`)
      .replace('#include <lights_fragment_end>', getDirectLightChunk(extension)),
  })
}

// Keeps a material (a drawing's own copy) out of the app's lighting extension: a define, so it compiles its own program.
export const setIsPlasticLightingSkipped = (material: Material, isSkipped: boolean) => {
  const others = Object.fromEntries(
    Object.entries(material.defines ?? {}).filter(([name]) => name !== LIGHTING_SKIPPED_DEFINE)
  )
  Object.assign(material, {
    defines: isSkipped ? { ...others, [LIGHTING_SKIPPED_DEFINE]: '' } : others,
    needsUpdate: true,
  })
}

// Gives a plastic material the app's lighting extension, after its look. The hooks are own properties, so a drawing's copy of the
// material (which takes them over) gets the extension too.
export const applyPlasticLighting = (material: Material) => {
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material)
  const previousCacheKey = material.customProgramCacheKey.bind(material)
  Object.assign(material, {
    onBeforeCompile: (
      shader: WebGLProgramParametersWithUniforms,
      renderer: Parameters<Material['onBeforeCompile']>[1]
    ) => {
      previousOnBeforeCompile(shader, renderer)
      if (activeExtension !== null) extendShader(shader, activeExtension)
    },
    customProgramCacheKey: () =>
      `${previousCacheKey()}|plastic-lighting-${activeExtension?.cacheKey ?? 'none'}`,
  })
}
