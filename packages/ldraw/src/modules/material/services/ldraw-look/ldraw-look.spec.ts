import { MeshPhysicalMaterial } from 'three'
import type { WebGLProgramParametersWithUniforms } from 'three'
import {
  getLookLabels,
  getLookPreset,
  getLookPresetFromLabel,
  LOOK_APPEARANCES,
} from './ldraw-look.ts'
import { applyLookShader, getLookNeedsShader } from './ldraw-look-shader.ts'
import { LookEdges, LookPreset, LookShading } from './ldraw-look.types.ts'

describe('getLookPreset', () => {
  it('reads the look from the address, defaults to the manual look and no longer offers the studio or movie looks', () => {
    // Arrange / Act
    const presets = [
      '?hd',
      '?hd&look=manual',
      '?hd&look=toon',
      '?hd&look=retro',
      '?hd&look=photo',
      '?hd&look=studio',
      '?look=odd',
    ].map(getLookPreset)

    // Assert
    expect(presets).toEqual([
      LookPreset.MANUAL,
      LookPreset.MANUAL,
      LookPreset.TOON,
      LookPreset.RETRO,
      LookPreset.PHOTO,
      LookPreset.MANUAL,
      LookPreset.MANUAL,
    ])
  })
})

describe('look labels', () => {
  it('round-trips the developer panel choices', () => {
    // Arrange / Act
    const labels = getLookLabels()

    // Assert
    expect(labels).toEqual(['Manual', 'Photo', 'Instructions', 'Toon', 'Game', 'Retro 1999'])
    expect(labels.map(getLookPresetFromLabel)).toEqual(Object.values(LookPreset))
  })
})

describe('look appearances', () => {
  it('keeps the manual look as the physical plastic and gives every other look its own shading and edges', () => {
    // Arrange / Act
    const { manual, photo, instructions, toon, game, retro } = LOOK_APPEARANCES

    // Assert
    expect([manual.shading, manual.edges, getLookNeedsShader(manual)]).toEqual([
      LookShading.PLASTIC,
      LookEdges.HIDDEN,
      false,
    ])
    expect([instructions, toon, game, retro].map((look) => [look.shading, look.edges])).toEqual([
      [LookShading.INSTRUCTIONS, LookEdges.LIBRARY],
      [LookShading.TOON, LookEdges.INK],
      [LookShading.GAME, LookEdges.HIDDEN],
      [LookShading.RETRO, LookEdges.HIDDEN],
    ])
    expect(game.occlusionStrength).toBeGreaterThan(0)
    expect([photo.shading, photo.edges, photo.isGraded, photo.occlusionStrength > 0]).toEqual([
      LookShading.PLASTIC,
      LookEdges.HIDDEN,
      true,
      true,
    ])
  })
})

describe('applyLookShader', () => {
  it('compiles the stylised lighting in place of the physical plastic, with the occlusion only when a grid is given and no highlight on rubber', () => {
    // Arrange
    const material = new MeshPhysicalMaterial()
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {\n#include <begin_vertex>\n}',
      fragmentShader:
        'void main() {\n#include <color_fragment>\n#include <aomap_fragment>\n#include <opaque_fragment>\n#include <colorspace_fragment>\n}',
    }

    // Act
    applyLookShader(material, LOOK_APPEARANCES.retro, null, true)
    material.onBeforeCompile(shader as unknown as WebGLProgramParametersWithUniforms, undefined!)

    // Assert
    expect(material.defines).toEqual({ STANDARD: '', PHYSICAL: '' })
    expect(shader.fragmentShader).toMatch(
      /^#define LOOK_SHADING_RETRO\n#define LOOK_STYLISED\n#define LOOK_MATTE\n/
    )
    expect(material.customProgramCacheKey()).toBe(
      'ldraw-look-LOOK_SHADING_RETRO-LOOK_STYLISED-LOOK_MATTE'
    )
    expect(shader.fragmentShader).toContain('getLookBayer(gl_FragCoord.xy)')
    expect(Object.keys(shader.uniforms)).toEqual(['lookSaturation', 'lookExposure', 'lookContrast'])
  })
})
