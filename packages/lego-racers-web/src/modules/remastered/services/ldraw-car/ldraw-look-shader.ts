import type { MeshPhysicalMaterial, WebGLProgramParametersWithUniforms } from 'three'
import { OCCLUSION_NORMAL_ATTRIBUTE, OCCLUSION_POSITION_ATTRIBUTE } from './ldraw-occlusion.ts'
import type { OcclusionVolume } from './ldraw-occlusion.types.ts'
import type { LookAppearance } from './ldraw-look.types.ts'

const VERTEX_DECLARATIONS = `
attribute vec3 ${OCCLUSION_POSITION_ATTRIBUTE};
attribute vec3 ${OCCLUSION_NORMAL_ATTRIBUTE};
varying vec3 vLookPosition;
varying vec3 vLookNormal;
void main() {`

const FRAGMENT_DECLARATIONS = `
uniform highp sampler3D lookVolume;
uniform vec3 lookVolumeOrigin;
uniform vec3 lookVolumeSize;
uniform float lookCell;
uniform float lookOcclusionStrength;
uniform float lookRoughnessVariation;
uniform float lookWear;
uniform float lookExposure;
uniform float lookWarmth;
uniform float lookSaturation;
uniform float lookContrast;
uniform float lookIsGraded;
varying vec3 vLookPosition;
varying vec3 vLookNormal;

float lookHash(vec3 cell) {
  return fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float lookNoise(vec3 point) {
  vec3 cell = floor(point);
  vec3 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  float low = mix(
    mix(mix(lookHash(cell), lookHash(cell + vec3(1, 0, 0)), blend.x),
        mix(lookHash(cell + vec3(0, 1, 0)), lookHash(cell + vec3(1, 1, 0)), blend.x), blend.y),
    mix(mix(lookHash(cell + vec3(0, 0, 1)), lookHash(cell + vec3(1, 0, 1)), blend.x),
        mix(lookHash(cell + vec3(0, 1, 1)), lookHash(cell + vec3(1, 1, 1)), blend.x), blend.y),
    blend.z);
  return low;
}

float lookVolumeAt(vec3 point) {
  return texture(lookVolume, (point - lookVolumeOrigin) / lookVolumeSize).r;
}

// The share of the hemisphere above the point that the model's own surface fills, from seven taps of the baked grid.
float getLookOcclusion(vec3 point, vec3 normal) {
  vec3 helper = abs(normal.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 tangent = normalize(cross(normal, helper));
  vec3 bitangent = cross(normal, tangent);
  float near = lookCell * 2.4;
  float far = lookCell * 4.5;
  float slanted = lookCell * 3.2;
  float filled = 0.14 * lookVolumeAt(point + normal * near) + 0.14 * lookVolumeAt(point + normal * far);
  filled += 0.18 * lookVolumeAt(point + normalize(normal + 0.9 * tangent) * slanted);
  filled += 0.18 * lookVolumeAt(point + normalize(normal - 0.9 * tangent) * slanted);
  filled += 0.18 * lookVolumeAt(point + normalize(normal + 0.9 * bitangent) * slanted);
  filled += 0.18 * lookVolumeAt(point + normalize(normal - 0.9 * bitangent) * slanted);
  return clamp(filled * 1.4, 0.0, 1.0);
}

vec3 getLookLinear(vec3 value) {
  return mix(value / 12.92, pow((value + 0.055) / 1.055, vec3(2.4)), step(0.04045, value));
}
`

const ROUGHNESS_CHUNK = `
#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (lookNoise(vLookPosition * 0.07) - 0.5) * 2.0 * lookRoughnessVariation, 0.04, 1.0);
`

// The colours are the library's, as numbers that were never decoded: a graded look decodes them once, here, so the lights act on
// linear colour and the encoding at the end gives them back. The scratches are thin pale streaks, stretched along each axis.
const COLOR_CHUNK = `
#include <color_fragment>
if (lookIsGraded > 0.5) diffuseColor.rgb = getLookLinear(diffuseColor.rgb);
float lookScratch = 0.0;
if (lookWear > 0.0) {
  float along = lookNoise(vLookPosition * vec3(0.9, 0.05, 0.05)) * lookNoise(vLookPosition * vec3(2.3, 0.1, 0.1));
  float across = lookNoise(vLookPosition * vec3(0.05, 0.9, 0.05)) * lookNoise(vLookPosition * vec3(0.1, 2.3, 0.1));
  float upright = lookNoise(vLookPosition * vec3(0.05, 0.05, 0.9)) * lookNoise(vLookPosition * vec3(0.1, 0.1, 2.3));
  lookScratch = smoothstep(0.5, 0.56, max(along, max(across, upright))) * lookWear;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85), lookScratch * 0.22);
}
`

// Fingerprints are broad smudges that dull the clear coat; scratches roughen it.
const OCCLUSION_CHUNK = `
#include <lights_physical_fragment>
if (lookWear > 0.0) {
  float smudge = smoothstep(0.58, 0.78, lookNoise(vLookPosition * 0.07 + 4.0));
  float fingertip = smoothstep(0.62, 0.7, lookNoise(vLookPosition * 0.19 + 9.0));
  material.clearcoatRoughness = clamp(material.clearcoatRoughness + lookWear * (0.32 * smudge + 0.2 * fingertip + 0.5 * lookScratch), 0.0, 1.0);
  material.roughness = clamp(material.roughness + lookWear * 0.1 * smudge, 0.04, 1.0);
}
`

const AMBIENT_CHUNK = `
#include <aomap_fragment>
if (lookOcclusionStrength > 0.0) {
  float lookOpenness = 1.0 - lookOcclusionStrength * getLookOcclusion(vLookPosition, normalize(vLookNormal));
  reflectedLight.indirectDiffuse *= lookOpenness;
  reflectedLight.indirectSpecular *= mix(1.0, lookOpenness, 0.8);
  reflectedLight.directDiffuse *= mix(1.0, lookOpenness, 0.35);
}
`

// Filmic curve (Narkowicz's fit of ACES), a warm tint, saturation, the sRGB encoding and an S curve; the track's own output is not touched.
const OUTPUT_CHUNK = `
if (lookIsGraded > 0.5) {
  vec3 graded = gl_FragColor.rgb * lookExposure;
  graded = clamp((graded * (2.51 * graded + 0.03)) / (graded * (2.43 * graded + 0.59) + 0.14), 0.0, 1.0);
  graded *= vec3(1.0 + lookWarmth, 1.0 + lookWarmth * 0.35, 1.0 - lookWarmth);
  float lookLuma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  graded = mix(vec3(lookLuma), graded, lookSaturation);
  vec3 encoded = sRGBTransferOETF(vec4(graded, 1.0)).rgb;
  encoded = mix(encoded, encoded * encoded * (3.0 - 2.0 * encoded), lookContrast);
  gl_FragColor = vec4(encoded, gl_FragColor.a);
} else {
  #include <colorspace_fragment>
}
`

const VERTEX_COPY = `
#include <begin_vertex>
vLookPosition = ${OCCLUSION_POSITION_ATTRIBUTE};
vLookNormal = ${OCCLUSION_NORMAL_ATTRIBUTE};
`

// Gives the plastic the parts of a look that need the shader: occlusion from the model's baked grid, the roughness variation, the wear
// and the grade. A look with none of them keeps three.js's own shader.
export const getLookNeedsShader = (look: LookAppearance): boolean =>
  look.occlusionStrength > 0 || look.roughnessVariation > 0 || look.wear > 0 || look.isGraded

export const applyLookShader = (
  material: MeshPhysicalMaterial,
  look: LookAppearance,
  volume: OcclusionVolume
) => {
  const uniforms = {
    lookVolume: { value: volume.texture },
    lookVolumeOrigin: { value: volume.origin },
    lookVolumeSize: { value: volume.size },
    lookCell: { value: volume.cell },
    lookOcclusionStrength: { value: look.occlusionStrength },
    lookRoughnessVariation: { value: look.roughnessVariation },
    lookWear: { value: look.wear },
    lookExposure: { value: look.exposure },
    lookWarmth: { value: look.warmth },
    lookSaturation: { value: look.saturation },
    lookContrast: { value: look.contrast },
    lookIsGraded: { value: look.isGraded ? 1 : 0 },
  }
  const onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    Object.assign(shader, {
      vertexShader: shader.vertexShader
        .replace('void main() {', VERTEX_DECLARATIONS)
        .replace('#include <begin_vertex>', VERTEX_COPY),
      fragmentShader: shader.fragmentShader
        .replace('void main() {', `${FRAGMENT_DECLARATIONS}\nvoid main() {`)
        .replace('#include <roughnessmap_fragment>', ROUGHNESS_CHUNK)
        .replace('#include <color_fragment>', COLOR_CHUNK)
        .replace('#include <lights_physical_fragment>', OCCLUSION_CHUNK)
        .replace('#include <aomap_fragment>', AMBIENT_CHUNK)
        .replace('#include <colorspace_fragment>', OUTPUT_CHUNK),
    })
  }
  Object.assign(material, { customProgramCacheKey: () => 'ldraw-look', onBeforeCompile })
}
