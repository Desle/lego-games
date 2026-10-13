import { ShaderMaterial } from 'three'
import type { Texture } from 'three'

const VERTEX_SHADER = `
varying vec2 surfaceCoordinate;
void main() {
  surfaceCoordinate = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// An effect drawn additively (a shield, a flame) adds colour but leaves the cleared target's alpha at zero, so its coverage is read
// from its brightness as well.
const FRAGMENT_SHADER = `
uniform sampler2D reference;
uniform float opacity;
varying vec2 surfaceCoordinate;
void main() {
  vec4 texel = texture2D(reference, surfaceCoordinate);
  float coverage = max(texel.a, max(texel.r, max(texel.g, texel.b)));
  gl_FragColor = vec4(texel.rgb, coverage * opacity);
}`

// The original drawn on its own (cleared see-through) laid over the build view, translucent.
export const createGhostOverlayMaterial = (reference: Texture, opacity: number): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: { reference: { value: reference }, opacity: { value: opacity } },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
