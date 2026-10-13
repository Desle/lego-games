import type { MeshPhysicalMaterial, WebGLProgramParametersWithUniforms } from 'three'
import {
  OCCLUSION_NORMAL_ATTRIBUTE,
  OCCLUSION_POSITION_ATTRIBUTE,
} from '../ldraw-occlusion/ldraw-occlusion.ts'
import type { OcclusionVolume } from '../ldraw-occlusion/ldraw-occlusion.types.ts'
import { LookShading } from './ldraw-look.types.ts'
import type { LookAppearance } from './ldraw-look.types.ts'

const VERTEX_DECLARATIONS = `
#ifdef LOOK_OCCLUSION
attribute vec3 ${OCCLUSION_POSITION_ATTRIBUTE};
attribute vec3 ${OCCLUSION_NORMAL_ATTRIBUTE};
varying vec3 vLookPosition;
varying vec3 vLookNormal;
#endif
void main() {`

const FRAGMENT_DECLARATIONS = `
uniform float lookSaturation;
uniform float lookExposure;
uniform float lookContrast;
#ifdef LOOK_OCCLUSION
uniform highp sampler3D lookVolume;
uniform vec3 lookVolumeOrigin;
uniform vec3 lookVolumeSize;
uniform float lookCell;
uniform float lookOcclusionStrength;
uniform float lookRoughnessVariation;
varying vec3 vLookPosition;
varying vec3 vLookNormal;

float lookHash(vec3 cell) {
  return fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float lookNoise(vec3 point) {
  vec3 cell = floor(point);
  vec3 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(
    mix(mix(lookHash(cell), lookHash(cell + vec3(1, 0, 0)), blend.x),
        mix(lookHash(cell + vec3(0, 1, 0)), lookHash(cell + vec3(1, 1, 0)), blend.x), blend.y),
    mix(mix(lookHash(cell + vec3(0, 0, 1)), lookHash(cell + vec3(1, 0, 1)), blend.x),
        mix(lookHash(cell + vec3(0, 1, 1)), lookHash(cell + vec3(1, 1, 1)), blend.x), blend.y),
    blend.z);
}

float lookVolumeAt(vec3 point) {
  return texture(lookVolume, (point - lookVolumeOrigin) / lookVolumeSize).r;
}

// The share of the hemisphere above the point that the model's own surface fills, from six taps of the baked grid.
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
#endif

float getLookLuma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec3 getLookLinear(vec3 value) {
  return mix(value / 12.92, pow((value + 0.055) / 1.055, vec3(2.4)), step(0.04045, value));
}

// The share (0 to 1) of a lamp's light that a surface turned by facing (N . L) to it takes, in each stylised look.
float getLookRamp(float facing) {
  #if defined(LOOK_SHADING_INSTRUCTIONS) || defined(LOOK_SHADING_GAME)
  float wrapped = 0.5 + 0.5 * facing;
  return wrapped * wrapped;
  #else
  return max(facing, 0.0);
  #endif
}

// Three hard bands (shadow, half tone, lit), each step anti-aliased over one pixel.
float getLookBands(float lit) {
  float width = max(fwidth(lit), 0.001);
  return 0.5 + 0.25 * smoothstep(0.1 - width, 0.1 + width, lit) + 0.25 * smoothstep(0.55 - width, 0.55 + width, lit);
}

// How bright a surface is (1: the colour as the library names it) for the share of the studio's light it takes. The stylised looks
// use the studio's directions and balance, not its strength, so a figure, a car and a menu look alike.
float getLookLight(float shade) {
  #if defined(LOOK_SHADING_INSTRUCTIONS)
  return 0.72 + 0.36 * shade;
  #elif defined(LOOK_SHADING_TOON)
  return getLookBands(shade);
  #elif defined(LOOK_SHADING_GAME)
  return 0.42 + 0.78 * shade;
  #else
  return 0.55 + 0.6 * shade;
  #endif
}

// A 4 x 4 ordered dither threshold, in the units of one 16-bit colour step.
float getLookBayer(vec2 pixel) {
  const float thresholds[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  int column = int(mod(pixel.x, 4.0));
  int row = int(mod(pixel.y, 4.0));
  return (thresholds[row * 4 + column] + 0.5) / 16.0;
}
`

const ROUGHNESS_CHUNK = `
#include <roughnessmap_fragment>
#ifdef LOOK_OCCLUSION
roughnessFactor = clamp(roughnessFactor + (lookNoise(vLookPosition * 0.07) - 0.5) * 2.0 * lookRoughnessVariation, 0.04, 1.0);
#endif
`

// The colours are the library's, as numbers that were never decoded: a graded look decodes them once, here, so the lights act on
// linear colour and the encoding at the end gives them back. Other looks change the saturation here.
const COLOR_CHUNK = `
#include <color_fragment>
#ifdef LOOK_GRADED
diffuseColor.rgb = getLookLinear(diffuseColor.rgb);
#else
diffuseColor.rgb = max(mix(vec3(getLookLuma(diffuseColor.rgb)), diffuseColor.rgb, lookSaturation), 0.0);
#endif
`

const AMBIENT_CHUNK = `
#include <aomap_fragment>
float lookOpenness = 1.0;
#ifdef LOOK_OCCLUSION
lookOpenness = 1.0 - lookOcclusionStrength * getLookOcclusion(vLookPosition, normalize(vLookNormal));
reflectedLight.indirectDiffuse *= lookOpenness;
reflectedLight.indirectSpecular *= mix(1.0, lookOpenness, 0.8);
reflectedLight.directDiffuse *= mix(1.0, lookOpenness, 0.35);
#endif
`

// The stylised looks replace three.js's lighting with their own: the share of the studio's light a surface takes, through the
// look's ramp, sets its brightness. Only the emissive term is kept (the pickups' glow, the faces' room light). Rubber takes no
// highlight.
const STYLISED_LIGHT_CHUNK = `
#ifdef LOOK_STYLISED
vec3 lookView = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
float lookShade = 0.0;
float lookHighlight = 0.0;
float lookLightSum = 0.0;
#if NUM_DIR_LIGHTS > 0
for (int lookIndex = 0; lookIndex < NUM_DIR_LIGHTS; lookIndex++) {
  vec3 lookDirection = directionalLights[lookIndex].direction;
  float lookWeight = getLookLuma(directionalLights[lookIndex].color);
  float lookHalfway = max(dot(normal, normalize(lookDirection + lookView)), 0.0);
  lookShade += getLookRamp(dot(normal, lookDirection)) * lookWeight;
  lookLightSum += lookWeight;
  #if defined(LOOK_SHADING_TOON)
  float lookWidth = max(fwidth(lookHalfway), 0.001);
  lookHighlight += smoothstep(0.97 - lookWidth, 0.97 + lookWidth, lookHalfway) * lookWeight;
  #elif defined(LOOK_SHADING_GAME)
  lookHighlight += pow(lookHalfway, 20.0) * lookWeight;
  #endif
}
#endif
lookShade /= max(lookLightSum, 0.0001);
lookHighlight /= max(lookLightSum, 0.0001);
#ifdef LOOK_MATTE
lookHighlight = 0.0;
#endif
outgoingLight = diffuseColor.rgb * getLookLight(lookShade) * mix(1.0, lookOpenness, 0.85) + totalEmissiveRadiance;
#if defined(LOOK_SHADING_TOON)
outgoingLight += vec3(0.55) * lookHighlight;
#elif defined(LOOK_SHADING_GAME)
outgoingLight += vec3(0.3) * lookHighlight;
float lookRim = pow(1.0 - max(dot(normal, lookView), 0.0), 4.0);
outgoingLight += lookRim * 0.35 * diffuseColor.rgb * lookOpenness;
#endif
#endif
#include <opaque_fragment>
`

// A graded look: filmic curve (Narkowicz's fit of ACES), saturation, the sRGB encoding and an S curve. The stylised looks show the
// library's colours as it names them: lit in linear light, encoded to sRGB once at the end. The 1999 game drew in 16-bit colour:
// five bits of red and blue, six of green, dithered. The track's own output is not touched.
const OUTPUT_CHUNK = `
#ifdef LOOK_GRADED
vec3 lookGraded = gl_FragColor.rgb * lookExposure;
lookGraded = clamp((lookGraded * (2.51 * lookGraded + 0.03)) / (lookGraded * (2.43 * lookGraded + 0.59) + 0.14), 0.0, 1.0);
lookGraded = mix(vec3(getLookLuma(lookGraded)), lookGraded, lookSaturation);
vec3 lookEncoded = sRGBTransferOETF(vec4(lookGraded, 1.0)).rgb;
lookEncoded = mix(lookEncoded, lookEncoded * lookEncoded * (3.0 - 2.0 * lookEncoded), lookContrast);
gl_FragColor = vec4(lookEncoded, gl_FragColor.a);
#else
#include <colorspace_fragment>
#endif
#ifdef LOOK_STYLISED
gl_FragColor.rgb = sRGBTransferOETF(vec4(clamp(gl_FragColor.rgb, 0.0, 1.0), 1.0)).rgb;
#endif
#ifdef LOOK_SHADING_RETRO
vec3 lookLevels = vec3(31.0, 63.0, 31.0);
gl_FragColor.rgb = floor(gl_FragColor.rgb * lookLevels + getLookBayer(gl_FragCoord.xy)) / lookLevels;
#endif
`

const VERTEX_COPY = `
#include <begin_vertex>
#ifdef LOOK_OCCLUSION
vLookPosition = ${OCCLUSION_POSITION_ATTRIBUTE};
vLookNormal = ${OCCLUSION_NORMAL_ATTRIBUTE};
#endif
`

// The baked occlusion grid carries a look's ambient occlusion and its roughness variation (the noise is in the grid's frame).
export const getLookNeedsOcclusion = (look: LookAppearance): boolean =>
  look.occlusionStrength > 0 || look.roughnessVariation > 0

// A look needs the shader when it lights the plastic itself, changes its colours, grades them, varies the roughness or darkens
// the plastic with the baked occlusion.
export const getLookNeedsShader = (look: LookAppearance): boolean =>
  look.shading !== LookShading.PLASTIC ||
  look.occlusionStrength > 0 ||
  look.roughnessVariation > 0 ||
  look.saturation !== 1 ||
  look.isGraded

const getDefines = (
  look: LookAppearance,
  isOccluded: boolean,
  isMatte: boolean
): Readonly<Record<string, string>> => ({
  [`LOOK_SHADING_${look.shading.toUpperCase()}`]: '',
  ...(look.shading === LookShading.PLASTIC ? {} : { LOOK_STYLISED: '' }),
  ...(look.isGraded ? { LOOK_GRADED: '' } : {}),
  ...(isOccluded ? { LOOK_OCCLUSION: '' } : {}),
  ...(isMatte ? { LOOK_MATTE: '' } : {}),
})

// Gives the plastic the parts of a look that need the shader: the stylised lighting, the colour change, the grade, the 16-bit
// output, and occlusion and roughness variation from the model's baked grid (only with a grid: the game's own brick meshes have
// none). A matte material (rubber) takes no highlight from the stylised lighting.
export const applyLookShader = (
  material: MeshPhysicalMaterial,
  look: LookAppearance,
  volume: OcclusionVolume | null,
  isMatte = false
) => {
  const isOccluded = volume !== null && getLookNeedsOcclusion(look)
  const lookDefines = getDefines(look, isOccluded, isMatte)
  const uniforms = {
    lookSaturation: { value: look.saturation },
    lookExposure: { value: look.exposure },
    lookContrast: { value: look.contrast },
    ...(volume === null
      ? {}
      : {
          lookVolume: { value: volume.texture },
          lookVolumeOrigin: { value: volume.origin },
          lookVolumeSize: { value: volume.size },
          lookCell: { value: volume.cell },
          lookOcclusionStrength: { value: look.occlusionStrength },
          lookRoughnessVariation: { value: look.roughnessVariation },
        }),
  }
  // The defines go into the source, not the material: a material's copy (a drawing's own, to fade it) resets its defines.
  const defineLines = Object.keys(lookDefines)
    .map((name) => `#define ${name}\n`)
    .join('')
  const onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms)
    Object.assign(shader, {
      vertexShader: `${defineLines}${shader.vertexShader}`
        .replace('void main() {', VERTEX_DECLARATIONS)
        .replace('#include <begin_vertex>', VERTEX_COPY),
      fragmentShader: `${defineLines}${shader.fragmentShader}`
        .replace('void main() {', `${FRAGMENT_DECLARATIONS}\nvoid main() {`)
        .replace('#include <roughnessmap_fragment>', ROUGHNESS_CHUNK)
        .replace('#include <color_fragment>', COLOR_CHUNK)
        .replace('#include <aomap_fragment>', AMBIENT_CHUNK)
        .replace('#include <opaque_fragment>', STYLISED_LIGHT_CHUNK)
        .replace('#include <colorspace_fragment>', OUTPUT_CHUNK),
    })
  }
  Object.assign(material, {
    customProgramCacheKey: () => `ldraw-look-${Object.keys(lookDefines).join('-')}`,
    onBeforeCompile,
  })
}
