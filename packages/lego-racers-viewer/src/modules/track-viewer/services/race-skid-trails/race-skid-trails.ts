import type { DecalWorld } from '@lego-games/lego-racers/decal'
import type { RacerPose } from '@lego-games/lego-racers/race-presentation'
import {
  addSkidTrailPoint,
  allocateSkidTrail,
  createSkidTrailPool,
  getSkidTrailKind,
  getSkidTrailMeshes,
  releaseSkidTrail,
  SKID_TRAIL_COUNT,
  stepSkidTrailPool,
} from '@lego-games/lego-racers/skid-trail'
import type { SkidTrailPool } from '@lego-games/lego-racers/skid-trail'
import { getFloatFromBits } from '@lego-games/lego-racers/simulation-math'
import type { BufferAttribute } from 'three'
import { Mesh, type Material, type Scene as ThreeScene } from 'three'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { createDecalMaterial, createDynamicGeometry } from '../dynamic-mesh/dynamic-mesh.ts'
import type { ImageMesh, RaceSkidTrails, TrailHandles } from './race-skid-trails.types.ts'

const WHEEL_COUNT = 4
const FRONT_WHEEL_COUNT = 2
const BYTE_MAXIMUM = 255
const CORNERS_PER_TRIANGLE = 3
// Four trails of three finished stretches and the one in progress, twelve triangles each.
const MAXIMUM_CORNERS = SKID_TRAIL_COUNT * 4 * 12 * CORNERS_PER_TRIANGLE
// 0x0043dcd0 lets go of a trail over a second.
const RELEASE_FADE_MILLISECONDS = 1000
// 0x004b05d8 (1/255): the image's alpha byte as the fraction the fade scales by (0x00491d20).
const ALPHA_FRACTION = getFloatFromBits(0x3b808081)
const IMAGE_NAMES = ['skid', 'trbskid'] as const

const createHandles = (): TrailHandles => ({
  trailIndices: Array<number | null>(WHEEL_COUNT).fill(null),
})

const createImageMesh = (
  trackScene: ThreeScene,
  assets: RaceAssets,
  imageName: string
): ImageMesh | null => {
  const material = assets.scene.materials.findLast((candidate) => candidate.name === imageName)
  if (material === undefined) return null
  const geometry = createDynamicGeometry(MAXIMUM_CORNERS)
  const three = createDecalMaterial(assets.scene, material)
  const mesh = new Mesh(geometry, three)
  mesh.frustumCulled = false
  mesh.visible = false
  mesh.renderOrder = 1
  trackScene.add(mesh)
  return { mesh, alpha: material.renderState.diffuseAlpha ?? BYTE_MAXIMUM }
}

// The skid marks of the cars (LegoRacers.exe 0x0043f1e0, the trails 0x00491c70..0x00492870): every racer step hands each
// wheel's point to its trail (a pool of four shared by all racers), and the trails project their stretches onto the track.
export const createRaceSkidTrails = (
  trackScene: ThreeScene,
  assets: RaceAssets,
  world: DecalWorld | null
): RaceSkidTrails => {
  const meshes: ReadonlyMap<string, ImageMesh | null> = new Map(
    IMAGE_NAMES.map((name) => [name, createImageMesh(trackScene, assets, name)] as const)
  )
  const racerCount = assets.definition.racers.length
  const handles = Array.from({ length: racerCount }, createHandles)
  const seenSteps = Array<number>(racerCount).fill(0)
  const seenReleases = Array<number>(racerCount).fill(0)
  let pool: SkidTrailPool = createSkidTrailPool()
  let pending: readonly RacerPose[] = []

  const getBaseAlpha = (imageName: string): number => {
    const alpha = meshes.get(imageName)?.alpha ?? BYTE_MAXIMUM
    return Math.fround(alpha * ALPHA_FRACTION)
  }

  const applyPose = (pose: RacerPose) => {
    const racerHandles = handles[pose.racerIndex]
    if (racerHandles === undefined) return
    const { skids } = pose
    const indices = racerHandles.trailIndices
    if (skids.releaseCount !== seenReleases[pose.racerIndex]) {
      seenReleases[pose.racerIndex] = skids.releaseCount
      indices.forEach((trailIndex, wheel) => {
        if (trailIndex !== null)
          pool = releaseSkidTrail(pool, trailIndex, RELEASE_FADE_MILLISECONDS)
        indices[wheel] = null
      })
    }
    const { step } = skids
    if (step === null || step.index === seenSteps[pose.racerIndex]) return
    seenSteps[pose.racerIndex] = step.index
    step.wheels.forEach((wheel, wheelIndex) => {
      const trailIndex = indices[wheelIndex]
      if (trailIndex !== null && trailIndex !== undefined) {
        pool = addSkidTrailPoint(pool, trailIndex, wheel.position, step.elapsedMilliseconds)
      }
    })
    step.wheels.forEach((wheel, wheelIndex) => {
      let held = indices[wheelIndex] ?? null
      const trail = held === null ? undefined : pool.trails[held]
      // 0x0043f43c compares the duration with the kind: a short trail's (248) never equals 250, so it stays.
      const isWrongKind =
        trail !== undefined &&
        (step.isSpinning ? trail.durationMilliseconds === 1000 : trail.durationMilliseconds === 250)
      if (held !== null && isWrongKind) {
        pool = releaseSkidTrail(pool, held, 0)
        held = null
      }
      if (wheel.isMarking && held === null) {
        const made = allocateSkidTrail(pool, getSkidTrailKind(step.isSpinning), {
          racerIndex: pose.racerIndex,
          width: skids.widths[wheelIndex < FRONT_WHEEL_COUNT ? 0 : 1],
          baseAlpha: getBaseAlpha(skids.imageName),
        })
        pool = made.pool
        held = made.index
      } else if (!wheel.isMarking && held !== null) {
        pool = releaseSkidTrail(pool, held, 0)
        held = null
      }
      indices[wheelIndex] = held
    })
  }

  const draw = () => {
    const triangleCounts = new Map<string, number>()
    for (const trailMesh of getSkidTrailMeshes(pool)) {
      const imageName =
        pending.find((pose) => pose.racerIndex === trailMesh.racerIndex)?.skids.imageName ??
        IMAGE_NAMES[0]
      const target = meshes.get(imageName)
      if (target === undefined || target === null) continue
      const positions = target.mesh.geometry.getAttribute('position') as BufferAttribute
      const coordinates = target.mesh.geometry.getAttribute('uv') as BufferAttribute
      const colors = target.mesh.geometry.getAttribute('color') as BufferAttribute
      const alpha = trailMesh.alpha < BYTE_MAXIMUM ? trailMesh.alpha : target.alpha
      let corner = (triangleCounts.get(imageName) ?? 0) * CORNERS_PER_TRIANGLE
      for (const triangle of trailMesh.triangles) {
        for (const vertex of triangle) {
          if (corner >= MAXIMUM_CORNERS) break
          positions.setXYZ(corner, vertex.x, vertex.y, vertex.z)
          coordinates.setXY(corner, vertex.u, vertex.v)
          colors.setXYZW(corner, 1, 1, 1, alpha / BYTE_MAXIMUM)
          corner += 1
        }
      }
      triangleCounts.set(imageName, corner / CORNERS_PER_TRIANGLE)
    }
    for (const [name, target] of meshes) {
      if (target === null) continue
      const count = (triangleCounts.get(name) ?? 0) * CORNERS_PER_TRIANGLE
      target.mesh.geometry.setDrawRange(0, count)
      for (const attribute of ['position', 'uv', 'color']) {
        ;(target.mesh.geometry.getAttribute(attribute) as BufferAttribute).needsUpdate = true
      }

      target.mesh.visible = count > 0
    }
  }

  return Object.freeze({
    setPoses: (poses: readonly RacerPose[]) => {
      pending = poses
      for (const pose of poses) applyPose(pose)
    },
    step: (elapsedMilliseconds: number) => {
      if (world !== null) pool = stepSkidTrailPool(pool, world, elapsedMilliseconds)
      draw()
    },
    dispose: () => {
      for (const target of meshes.values()) {
        if (target === null) continue
        trackScene.remove(target.mesh)
        target.mesh.geometry.dispose()
        ;(target.mesh.material as Material).dispose()
      }
    },
  })
}
