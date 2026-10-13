// The GLSL every shadow receiver shares (the track's baked materials and the LDraw plastic): the fragment's world position and
// the sun's visibility from the live and the baked shadow maps.

export const SHADOW_VERTEX_DECLARATIONS = `
varying vec3 vShadowWorld;
`

// After `#include <project_vertex>`.
export const SHADOW_WORLD_POSITION = `
vec4 shadowLocal = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
shadowLocal = instanceMatrix * shadowLocal;
#endif
vShadowWorld = (modelMatrix * shadowLocal).xyz;
`

export const SHADOW_FRAGMENT_DECLARATIONS = `
varying vec3 vShadowWorld;
uniform mat4 shadowMatrix;
uniform highp sampler2DShadow shadowMap;
uniform vec3 sunDirection;
uniform float ambientShare;
uniform float shadowTexel;
uniform float shadowMapTexel;
uniform float shadowDepthBias;
uniform float shadowStrength;
uniform float isBakedShadowEnabled;
uniform mat4 bakedShadowMatrix;
uniform highp sampler2DShadow bakedShadowMap;
uniform float bakedShadowTexel;
uniform vec2 bakedShadowMapTexel;
uniform float bakedShadowDepthBias;

// Nine hardware-filtered comparisons around the point; 1 where the map does not reach.
float getMapVisibility(highp sampler2DShadow map, vec3 coordinates, vec2 mapTexel, float depthBias) {
  if (coordinates.z >= 1.0 || coordinates.z <= 0.0 || coordinates.x < 0.0 || coordinates.x > 1.0 || coordinates.y < 0.0 || coordinates.y > 1.0) return 1.0;
  float visibility = 0.0;
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 offset = vec2(float(column), float(row)) * mapTexel * 1.25;
      visibility += texture(map, vec3(coordinates.xy + offset, coordinates.z - depthBias));
    }
  }
  return visibility / 9.0;
}

// The share of the sun that reaches a point (1: all of it), the darker of the two maps. The live map (cars, hazards) fades out
// smoothly towards its rim; the baked map (the static scenery of the whole track) has no rim inside the track. Each map is
// looked up at its own point, so a receiver can offset them by different amounts.
float getSunVisibility(vec3 livePoint, vec3 bakedPoint) {
  vec4 clip = shadowMatrix * vec4(livePoint, 1.0);
  float edge = 1.0 - smoothstep(0.35, 0.95, length(clip.xy));
  float visibility = 1.0;
  if (edge > 0.0) {
    visibility = mix(1.0, getMapVisibility(shadowMap, clip.xyz * 0.5 + 0.5, vec2(shadowMapTexel), shadowDepthBias), edge);
  }
  if (isBakedShadowEnabled > 0.5) {
    vec4 bakedClip = bakedShadowMatrix * vec4(bakedPoint, 1.0);
    visibility = min(visibility, getMapVisibility(bakedShadowMap, bakedClip.xyz * 0.5 + 0.5, bakedShadowMapTexel, bakedShadowDepthBias));
  }
  return visibility;
}
`
