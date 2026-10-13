import type { SceneRenderState } from '@lego-games/lego-racers/scene'
import { Mesh } from 'three'
import type { Group, Material, MeshBasicMaterial, WebGLProgramParametersWithUniforms } from 'three'
import type { ShadowUniforms } from './shadow-receiver.types.ts'
import {
  SHADOW_FRAGMENT_DECLARATIONS,
  SHADOW_VERTEX_DECLARATIONS,
  SHADOW_WORLD_POSITION,
} from './shadow-sampling.ts'

const TRACK_FRAGMENT_DECLARATIONS = `
${SHADOW_FRAGMENT_DECLARATIONS}
// How much of the baked brightness remains where the sun is blocked: the baked light is ambient + diffuse * cos, so a
// surface that faces the sun by cos keeps ambient / (ambient + diffuse * cos) of it.
float getShadowShade() {
  vec3 normal = normalize(cross(dFdx(vShadowWorld), dFdy(vShadowWorld)));
  float cosine = dot(normal, sunDirection);
  float remaining = ambientShare / (ambientShare + (1.0 - ambientShare) * max(cosine, 0.0));
  float visibility = getSunVisibility(vShadowWorld + normal * shadowTexel * 2.0, vShadowWorld + normal * bakedShadowTexel * 1.5);
  return mix(1.0, mix(remaining, 1.0, visibility), shadowStrength);
}
`

const getIsReceiver = (material: Material): boolean => {
  const renderState = material.userData['renderState'] as SceneRenderState | undefined
  return renderState !== undefined && !renderState.isBlendEnabled
}

const markedMaterials = new WeakSet<Material>()

// Makes a track material darken its colour where the shadow map says the sun is blocked, keeping its own shader changes.
// The track's colours are baked (no lights), so the shadow only scales what is already there: nothing is lit twice.
/* eslint-disable no-param-reassign -- the material is edited in place, three.js reads its hooks */
const makeReceiver = (material: MeshBasicMaterial, uniforms: ShadowUniforms) => {
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material)
  const previousCacheKey = material.customProgramCacheKey.bind(material)
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previousOnBeforeCompile(shader, renderer)
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SHADOW_VERTEX_DECLARATIONS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${SHADOW_WORLD_POSITION}`)

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TRACK_FRAGMENT_DECLARATIONS}`)
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight *= getShadowShade();\n#include <opaque_fragment>'
      )
  }
  material.customProgramCacheKey = () => `${previousCacheKey()}|shadow-receiver`
  material.needsUpdate = true
}
/* eslint-enable no-param-reassign -- end of the receiver edit */

export const makeTrackReceivers = (trackGroup: Group, uniforms: ShadowUniforms) =>
  trackGroup.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const material = object.material as MeshBasicMaterial
    if (markedMaterials.has(material) || !getIsReceiver(material)) return
    markedMaterials.add(material)
    makeReceiver(material, uniforms)
  })
