import type { PlasticLightingExtension } from '@lego-games/ldraw/material'
import {
  PLASTIC_BAKED_SHADOW_LIFT_TEXELS,
  PLASTIC_LIVE_SHADOW_LIFT,
} from './shadow-pass.constants.ts'
import {
  SHADOW_FRAGMENT_DECLARATIONS,
  SHADOW_VERTEX_DECLARATIONS,
  SHADOW_WORLD_POSITION,
} from './shadow-sampling.ts'
import { SHARED_SHADOW_UNIFORMS } from './shadow-uniforms.ts'

// The plastic is lit, not baked: the shadow takes away its direct light (the studio's lamps) and keeps the ambient and the
// reflected studio. Both maps are read from points moved towards the sun, so a surface never shadows itself. The live map holds
// the receiving car itself, so it is read from far enough towards the sun to be past it: a car does not shade itself (no acne,
// no dark half), and other cars and hazards shade it only from above that height.
const PLASTIC_FRAGMENT_DECLARATIONS = `
${SHADOW_FRAGMENT_DECLARATIONS}
uniform float plasticLiveShadowLift;
uniform float plasticBakedShadowLiftTexels;

float getPlasticSunShare() {
  if (shadowStrength <= 0.0) return 1.0;
  vec3 livePoint = vShadowWorld + sunDirection * plasticLiveShadowLift;
  vec3 bakedPoint = vShadowWorld + sunDirection * bakedShadowTexel * plasticBakedShadowLiftTexels;
  return mix(1.0, getSunVisibility(livePoint, bakedPoint), shadowStrength);
}
`

export const createPlasticShadowExtension = (): PlasticLightingExtension =>
  Object.freeze({
    cacheKey: 'racers-sun-shadow',
    uniforms: Object.freeze({
      ...SHARED_SHADOW_UNIFORMS,
      plasticLiveShadowLift: { value: PLASTIC_LIVE_SHADOW_LIFT },
      plasticBakedShadowLiftTexels: { value: PLASTIC_BAKED_SHADOW_LIFT_TEXELS },
    }),
    vertexDeclarations: SHADOW_VERTEX_DECLARATIONS,
    vertexChunk: SHADOW_WORLD_POSITION,
    fragmentDeclarations: PLASTIC_FRAGMENT_DECLARATIONS,
    directLightShare: 'getPlasticSunShare()',
  })
