import { createDecalFrame, projectDecal } from '@lego-games/lego-racers/decal'
import type { DecalFaceBatch, DecalTriangle } from '@lego-games/lego-racers/decal'
import {
  getRacerShadowAlpha,
  RACER_FIGURE_LEVEL_DISTANCE,
} from '@lego-games/lego-racers/race-presentation'
import type { RacerPose } from '@lego-games/lego-racers/race-presentation'
import { getFloatFromBits } from '@lego-games/lego-racers/simulation-math'
import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import type { Scene, SceneMesh } from '@lego-games/lego-racers/scene'
import {
  BufferAttribute,
  BufferGeometry,
  LessEqualDepth,
  Mesh,
  type Material,
  type Scene as ThreeScene,
} from 'three'
import { createSceneMaterial } from '../scene-object/scene-material.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'
import type { DecalSurface, RaceDecals } from './race-decals.types.ts'

// Material keyword 0x4a: the faces of this material take decals (0x00414b30 tests `flags & 0x20000`).
const DECAL_RECEIVER_FLAG = 0x20000
// 0x0043d9cc: a vehicle's decal holds at most 16 triangles.
const MAXIMUM_TRIANGLES = 16
const CORNERS_PER_TRIANGLE = 3
const BYTE_MAXIMUM = 255
// 0x004af914: the decal's instance is moved 0.4 along z when it is made (0x00414950), which lifts it off the track.
const DECAL_LIFT = getFloatFromBits(0x3ecccccd)

const getBatches = (scene: Scene, mesh: SceneMesh, assignmentIndex: number | null) => {
  const materialIndices =
    (assignmentIndex === null
      ? null
      : scene.materialAssignments[assignmentIndex]?.materialIndices) ?? mesh.materialIndices
  return mesh.drawBatches.map((batch): DecalFaceBatch => {
    const material = scene.materials[materialIndices[batch.materialSlot] ?? -1]
    const faces = Array.from(
      { length: batch.vertexIndices.length / CORNERS_PER_TRIANGLE },
      (_, face) =>
        [
          batch.vertexIndices[face * 3] ?? 0,
          batch.vertexIndices[face * 3 + 1] ?? 0,
          batch.vertexIndices[face * 3 + 2] ?? 0,
        ] as const
    )
    return {
      firstCommand: batch.firstCommand,
      isReceiver: ((material?.flags ?? 0) & DECAL_RECEIVER_FLAG) !== 0,
      faces,
    }
  })
}

// The surface decals fall on: the race's BSP tree instance (the track), its tree and mesh. A mirrored race has the engine
// negate y when it loads the mesh (the track is then drawn mirrored, see the race viewport), so the faces do too.
export const getDecalSurface = (scene: Scene, isMirrored: boolean): DecalSurface | null => {
  const instance = scene.instances.find(
    (candidate) => candidate.kind === SceneInstanceKind.BSP_TREE
  )
  const level = instance?.levels[0]
  const tree = scene.bspTrees[level?.bspTreeIndex ?? -1]
  const mesh = scene.meshes[level?.meshIndex ?? -1]
  if (level === undefined || tree === undefined || mesh === undefined) return null
  const positions = Float32Array.from(mesh.positions)
  if (isMirrored) {
    for (let index = 1; index < positions.length; index += 3)
      positions[index] = -(positions[index] ?? 0)
  }
  return Object.freeze({
    world: {
      tree: tree.tree,
      positions,
      batches: getBatches(scene, mesh, level.materialAssignmentIndex),
    },
  })
}

const createShadowMesh = (material: Material): Mesh => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(MAXIMUM_TRIANGLES * CORNERS_PER_TRIANGLE * 3), 3)
  )
  geometry.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array(MAXIMUM_TRIANGLES * CORNERS_PER_TRIANGLE * 2), 2)
  )
  geometry.setAttribute(
    'color',
    new BufferAttribute(new Uint8Array(MAXIMUM_TRIANGLES * CORNERS_PER_TRIANGLE * 4), 4, true)
  )
  const mesh = new Mesh(geometry, material)
  mesh.position.set(0, 0, DECAL_LIFT)
  mesh.frustumCulled = false
  mesh.visible = false
  // The shadow lies on the track: drawn after it.
  mesh.renderOrder = 1
  return mesh
}

const setTriangles = (mesh: Mesh, triangles: readonly DecalTriangle[], alpha: number): void => {
  const positions = mesh.geometry.getAttribute('position') as BufferAttribute
  const coordinates = mesh.geometry.getAttribute('uv') as BufferAttribute
  const colors = mesh.geometry.getAttribute('color') as BufferAttribute
  for (const [triangleIndex, triangle] of triangles.entries()) {
    for (const [cornerIndex, vertex] of triangle.entries()) {
      const corner = triangleIndex * CORNERS_PER_TRIANGLE + cornerIndex
      positions.setXYZ(corner, vertex.x, vertex.y, vertex.z)
      coordinates.setXY(corner, vertex.u, vertex.v)
      colors.setXYZW(corner, 1, 1, 1, alpha / BYTE_MAXIMUM)
    }
  }
  positions.needsUpdate = true
  coordinates.needsUpdate = true
  colors.needsUpdate = true
  mesh.geometry.setDrawRange(0, triangles.length * CORNERS_PER_TRIANGLE)
  // eslint-disable-next-line no-param-reassign -- three.js shows an object by setting its flag
  mesh.visible = triangles.length > 0
}

// The cars' shadows (LegoRacers.exe 0x0043fa50, GolDP-side decals 0x00414a30): one decal per racer, projected straight down
// onto the track every frame while the camera is within the figure's draw distance.
export const createRaceDecals = (
  trackScene: ThreeScene,
  assets: RaceAssets,
  isMirrored: boolean
): RaceDecals => {
  const surface = getDecalSurface(assets.scene, isMirrored)
  const shadows = assets.definition.racers.map((racer) => {
    const material = assets.scene.materials.find(
      (candidate) => candidate.name === racer.appearance.shadowImageName
    )
    if (surface === null || material === undefined) return null
    // 0x0043fc20 draws the decal under an alpha of its own (device slot 0xb8): the material's colour key stays off.
    const three = createSceneMaterial(
      { ...material, renderState: { ...material.renderState, isAlphaTestEnabled: false } },
      assets.scene.textures,
      new Map()
    )
    three.depthWrite = true
    three.depthFunc = LessEqualDepth
    const mesh = createShadowMesh(three)
    trackScene.add(mesh)
    return { mesh }
  })
  return Object.freeze({
    update: (poses: readonly RacerPose[], eye: Vector3Like) => {
      for (const pose of poses) {
        const shadow = shadows[pose.racerIndex]
        if (shadow === undefined || shadow === null || surface === null) continue
        const centre = pose.partCentres?.wheels
        const squaredDistance =
          centre === undefined
            ? Infinity
            : (eye.x - centre.x) ** 2 + (eye.y - centre.y) ** 2 + (eye.z - centre.z) ** 2
        // 0x0043fa50 projects only within the figure's draw distance (strictly), 0x0043fc20 draws it faded.
        const alpha =
          pose.shadow === null || !(squaredDistance < RACER_FIGURE_LEVEL_DISTANCE)
            ? null
            : getRacerShadowAlpha(pose.shadow, eye)
        if (pose.shadow === null || alpha === null) {
          shadow.mesh.visible = false
          continue
        }
        setTriangles(
          shadow.mesh,
          projectDecal(surface.world, createDecalFrame(pose.shadow.placement)),
          alpha
        )
      }
    },
    dispose: () => {
      for (const shadow of shadows) {
        if (shadow === null) continue
        trackScene.remove(shadow.mesh)
        shadow.mesh.geometry.dispose()
        ;(shadow.mesh.material as Material).dispose()
      }
    },
  })
}
