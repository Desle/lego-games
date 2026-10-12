import { createDecalFrame, projectDecal } from '@lego-games/lego-racers/decal'
import type { DecalWorld } from '@lego-games/lego-racers/decal'
import { getIsDecalWithinDistance } from '@lego-games/lego-racers/race-presentation'
import type { DecalView } from '@lego-games/lego-racers/race-presentation'
import type { Material, Mesh, Scene as ThreeScene } from 'three'
import {
  createDecalMaterial,
  createDecalMesh,
  setDecalTriangles,
} from '../dynamic-mesh/dynamic-mesh.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'
import type { RaceEffectDecals } from './race-effect-decals.types.ts'

const OPAQUE_ALPHA = 255

// The oil slick and the scars come from the power-up library, which every effect model's scene holds; the crane's shadow
// from the race's own materials.
const getMaterialScenes = (assets: RaceAssets) => [assets.effectModels.barrel.scene, assets.scene]

// The decals the effects lay on the track (0x004573a0 the oil slick, 0x00421850 an explosion's scar, 0x00490330 a crane's shadow): projected onto the
// track every frame, which gives the triangles the engine's one projection at the landing or its growth steps give.
export const createRaceEffectDecals = (
  trackScene: ThreeScene,
  assets: RaceAssets,
  world: DecalWorld | null
): RaceEffectDecals => {
  const materialScenes = getMaterialScenes(assets)
  const materials = new Map<string, Material>()
  const meshes: Mesh[] = []
  const getMaterial = (imageName: string): Material | null => {
    const known = materials.get(imageName)
    if (known !== undefined) return known
    const materialScene = materialScenes.find((scene) =>
      scene.materials.some((material) => material.name === imageName)
    )
    const source = materialScene?.materials.findLast((material) => material.name === imageName)
    if (materialScene === undefined || source === undefined) return null
    const created = createDecalMaterial(materialScene, source)
    materials.set(imageName, created)
    return created
  }
  const getMesh = (index: number, view: DecalView): Mesh | null => {
    const material = getMaterial(view.imageName)
    if (material === null) return null
    const known = meshes[index]
    if (known !== undefined && known.material === material) return known
    if (known !== undefined) trackScene.remove(known)
    const created = createDecalMesh(material, view.limits.maximumTriangles)
    trackScene.add(created)

    meshes[index] = created
    return created
  }
  return Object.freeze({
    update: (views: readonly DecalView[], eye: Vector3Like) => {
      for (const mesh of meshes) mesh.visible = false
      if (world === null) return
      for (const [index, view] of views.entries()) {
        if (!getIsDecalWithinDistance(view, eye)) continue
        const mesh = getMesh(index, view)
        if (mesh === null) continue
        setDecalTriangles(
          mesh,
          projectDecal(world, createDecalFrame(view.placement), view.limits),
          view.alpha ?? OPAQUE_ALPHA
        )
      }
    },
    dispose: () => {
      for (const mesh of meshes) {
        trackScene.remove(mesh)
        mesh.geometry.dispose()
      }
      for (const material of materials.values()) material.dispose()
    },
  })
}
