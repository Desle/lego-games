import type { SceneRenderState } from '@lego-games/lego-racers/scene'
import { Mesh } from 'three'
import type { Group, Material, MeshBasicMaterial, WebGLProgramParametersWithUniforms } from 'three'
import type { ShadowUniforms } from './shadow-receiver.types.ts'

const VERTEX_DECLARATIONS = `
varying vec3 vShadowWorld;
`

const VERTEX_WORLD_POSITION = `
#include <project_vertex>
vec4 shadowLocal = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
shadowLocal = instanceMatrix * shadowLocal;
#endif
vShadowWorld = (modelMatrix * shadowLocal).xyz;
`

const FRAGMENT_DECLARATIONS = `
varying vec3 vShadowWorld;
uniform mat4 shadowMatrix;
uniform highp sampler2DShadow shadowMap;
uniform vec3 sunDirection;
uniform float ambientShare;
uniform float shadowTexel;
uniform float shadowMapTexel;
uniform float shadowDepthBias;
uniform float shadowStrength;

// How much of the baked brightness remains where the sun is blocked: the baked light is ambient + diffuse * cos, so a
// surface that faces the sun by cos keeps ambient / (ambient + diffuse * cos) of it.
float getShadowShade() {
  vec3 normal = normalize(cross(dFdx(vShadowWorld), dFdy(vShadowWorld)));
  float cosine = dot(normal, sunDirection);
  float remaining = ambientShare / (ambientShare + (1.0 - ambientShare) * max(cosine, 0.0));
  vec4 clip = shadowMatrix * vec4(vShadowWorld + normal * shadowTexel * 2.0, 1.0);
  vec3 coordinates = clip.xyz * 0.5 + 0.5;
  float edge = 1.0 - smoothstep(0.7, 0.98, max(abs(clip.x), abs(clip.y)));
  if (coordinates.z >= 1.0 || coordinates.z <= 0.0 || edge <= 0.0) return 1.0;
  float visibility = 0.0;
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 offset = vec2(float(column), float(row)) * shadowMapTexel * 1.25;
      visibility += texture(shadowMap, vec3(coordinates.xy + offset, coordinates.z - shadowDepthBias));
    }
  }
  visibility /= 9.0;
  return mix(1.0, mix(remaining, 1.0, visibility), edge * shadowStrength);
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
      .replace('#include <common>', `#include <common>\n${VERTEX_DECLARATIONS}`)
      .replace('#include <project_vertex>', VERTEX_WORLD_POSITION)

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECLARATIONS}`)
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
