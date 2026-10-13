import type { IUniform } from 'three'

// What an app adds to the lighting of every plastic material: GLSL that decides how much of the direct lights reaches a
// fragment (a shadow map, a cloud cover). Ambient, hemisphere and reflected studio light are never touched.
export type PlasticLightingExtension = {
  // Part of the program cache key: two extensions with different GLSL must not share a program.
  readonly cacheKey: string
  // Shared by every plastic material: the app updates their values, never replaces the object.
  readonly uniforms: Readonly<Record<string, IUniform>>
  readonly vertexDeclarations: string
  // Runs after `#include <project_vertex>`, where `transformed` (model space) and `modelMatrix` are in scope.
  readonly vertexChunk: string
  readonly fragmentDeclarations: string
  // A GLSL float expression from 0 (no direct light) to 1 (all of it), evaluated once per fragment after the lights.
  readonly directLightShare: string
}
