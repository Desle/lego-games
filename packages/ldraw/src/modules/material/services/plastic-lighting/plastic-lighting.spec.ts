import { MeshPhysicalMaterial } from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import { applyPlasticLighting, setPlasticLightingExtension } from './plastic-lighting.ts'
import type { PlasticLightingExtension } from './plastic-lighting.types.ts'

const createShader = () => ({
  uniforms: {},
  vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <lights_fragment_end>\n}',
})

const compile = (material: MeshPhysicalMaterial, shader: ReturnType<typeof createShader>) =>
  material.onBeforeCompile(shader as unknown as WebGLProgramParametersWithUniforms, undefined!)

const EXTENSION: PlasticLightingExtension = {
  cacheKey: 'sun',
  uniforms: { sunShare: { value: 0.5 } },
  vertexDeclarations: 'varying vec3 vSun;',
  vertexChunk: 'vSun = transformed;',
  fragmentDeclarations: 'uniform float sunShare;',
  directLightShare: 'sunShare',
}

afterEach(() => setPlasticLightingExtension(null))

describe('applyPlasticLighting', () => {
  it('leaves the shader as it is when the app registers no extension', () => {
    // Arrange
    const material = new MeshPhysicalMaterial()
    const shader = createShader()
    applyPlasticLighting(material)

    // Act
    compile(material, shader)

    // Assert
    expect(shader).toEqual(createShader())
    expect(material.customProgramCacheKey()).toMatch(/plastic-lighting-none$/u)
  })

  it('scales only the direct light by the extension share, and a copy of the material gets it too', () => {
    // Arrange
    const material = new MeshPhysicalMaterial()
    applyPlasticLighting(material)
    const copy = material.clone()
    Object.assign(copy, {
      onBeforeCompile: Reflect.get(material, 'onBeforeCompile'),
      customProgramCacheKey: Reflect.get(material, 'customProgramCacheKey'),
    })
    const shader = createShader()
    setPlasticLightingExtension(EXTENSION)

    // Act
    compile(copy, shader)

    // Assert
    expect(shader.uniforms).toEqual(EXTENSION.uniforms)
    expect(shader.vertexShader).toContain('varying vec3 vSun;')
    expect(shader.vertexShader).toContain('#include <project_vertex>\nvSun = transformed;')
    expect(shader.fragmentShader).toContain('uniform float sunShare;')
    expect(shader.fragmentShader).toContain('float plasticDirectLight = clamp(sunShare, 0.0, 1.0);')
    expect(shader.fragmentShader).toContain('reflectedLight.directDiffuse *= plasticDirectLight;')
    expect(shader.fragmentShader).not.toContain('indirect')
    expect(copy.customProgramCacheKey()).toMatch(/plastic-lighting-sun$/u)
  })
})
