import { createPlasticShadowExtension } from './plastic-shadow.ts'
import { SHADOW_FRAGMENT_DECLARATIONS, SHADOW_WORLD_POSITION } from './shadow-sampling.ts'
import { SHARED_SHADOW_UNIFORMS } from './shadow-uniforms.ts'

describe('createPlasticShadowExtension', () => {
  it('reads the very uniforms the shadow pass fills, so the plastic follows each race', () => {
    // Arrange
    const extension = createPlasticShadowExtension()

    // Act
    const sharedNames = Object.keys(
      SHARED_SHADOW_UNIFORMS
    ) as (keyof typeof SHARED_SHADOW_UNIFORMS)[]

    // Assert
    for (const name of sharedNames)
      expect(extension.uniforms[name]).toBe(SHARED_SHADOW_UNIFORMS[name])
    expect(SHARED_SHADOW_UNIFORMS.shadowStrength.value).toBe(0)
  })

  it('samples the maps with the track receiver code and scales only the direct light', () => {
    // Arrange / Act
    const extension = createPlasticShadowExtension()

    // Assert
    expect(extension.fragmentDeclarations).toContain(SHADOW_FRAGMENT_DECLARATIONS)
    expect(extension.vertexChunk).toBe(SHADOW_WORLD_POSITION)
    expect(extension.directLightShare).toBe('getPlasticSunShare()')
  })
})
