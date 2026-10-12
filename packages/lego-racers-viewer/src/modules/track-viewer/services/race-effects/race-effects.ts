import type { EffectViews, EffectView, RacerPose } from '@lego-games/lego-racers/race-presentation'
import type { Matrix3 } from '@lego-games/lego-racers/simulation-math'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { Scene as ThreeScene } from 'three'
import { Matrix4 } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import { BRICK_LEVEL_DISTANCE } from '@lego-games/lego-racers/race-presentation'
import type { FigureAnimation } from '@lego-games/lego-racers/racer'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'
import { getIsWithinLevelDistance } from '../scene-object/level-distance.ts'
import { getEffectFigureState } from '@lego-games/lego-racers/race-presentation'
import { getFrameMatrix, getUprightRotation } from '../frame-matrix/frame-matrix.ts'
import { createModelObject } from '../model-object/model-object.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { EffectModels } from '../race-assets/race-assets.types.ts'
import type { RaceEffects } from './race-effects.types.ts'

// The rows of a frame whose first axis points along `heading` with z up (a rocket flies nose first).
const getHeadingMatrix = (
  heading: EffectView['heading'],
  position: EffectView['position']
): Matrix4 => {
  const { x, y, z } = heading ?? { x: 1, y: 0, z: 0 }
  const length = Math.hypot(x, y, z) || 1
  const forward = { x: x / length, y: y / length, z: z / length }
  const sideLength = Math.hypot(forward.y, forward.x) || 1
  const side = { x: -forward.y / sideLength, y: forward.x / sideLength, z: 0 }
  const up = {
    x: forward.y * side.z - forward.z * side.y,
    y: forward.z * side.x - forward.x * side.z,
    z: forward.x * side.y - forward.y * side.x,
  }
  return new Matrix4().set(
    forward.x,
    side.x,
    up.x,
    position.x,
    forward.y,
    side.y,
    up.y,
    position.y,
    forward.z,
    side.z,
    up.z,
    position.z,
    0,
    0,
    0,
    1
  )
}

// 0x0045c160: the shield sits two units above the racer's position.
const SHIELD_HEIGHT = 2

// 0x00456db0: rocket k holds state 2 for (frames - 1) / rate milliseconds of clip k.
const getRocketLaunchMilliseconds = (
  animations: readonly FigureAnimation[],
  rocketIndex: number
): number => {
  const animation = animations[rocketIndex]
  return animation === undefined ? 0 : Math.trunc((animation.frameCount - 1) / animation.rate)
}

// 0x0045cf90: a turbo's figures sit 2 units behind the display figure's position and 3 above it, in its frame.
const TURBO_BEHIND = 2
const TURBO_ABOVE = 3
const getTurboPosition = (pose: RacerPose): Vector3Like => {
  const [forwardX, forwardY, forwardZ, , , , upX, upY, upZ] = pose.rotation
  return {
    x: pose.position.x - forwardX * TURBO_BEHIND + upX * TURBO_ABOVE,
    y: pose.position.y - forwardY * TURBO_BEHIND + upY * TURBO_ABOVE,
    z: pose.position.z - forwardZ * TURBO_BEHIND + upZ * TURBO_ABOVE,
  }
}

const MILLISECONDS_PER_SECOND = 1000
// The scroll the original adds stays below 1 (it wraps).
const getWrappedFraction = (value: number): number => value - Math.floor(value)

// 0x0045cf90 sets the figures' orientation (slot 0x40, 0x00410900) from the display figure's second row and third row: the
// first row of the turbo's frame is the car's side, the second its backwards axis.
const getTurboRotation = (pose: RacerPose): Matrix3 => {
  const [forwardX, forwardY, forwardZ, sideX, sideY, sideZ, upX, upY, upZ] = pose.rotation
  return [sideX, sideY, sideZ, -forwardX, -forwardY, -forwardZ, upX, upY, upZ]
}

// A growing pool of one model: `use` shows the next free copy, `reset` hides them all.
const createPool = (scene: ThreeScene, model: ModelScene) => {
  const copies: ModelObject[] = []
  let used = 0
  return {
    reset: () => {
      for (const copy of copies) copy.group.visible = false
      used = 0
    },
    use: (): ModelObject => {
      let copy = copies[used]
      if (copy === undefined) {
        copy = createModelObject(model)
        copy.group.visible = false
        copies.push(copy)
        scene.add(copy.group)
      }
      used += 1
      copy.group.visible = true
      return copy
    },
    dispose: () => {
      for (const copy of copies) copy.object.dispose()
    },
  }
}

// Draws the effects the race reports: the bricks on the track (spinning, at the scale their state gives), the rockets nose first, the barrels, the magnets and the spiked explosions at the
// scale the engine gives them. Effects without a model here (cannon ball, grapple hook, wand, plain explosion) are skipped.
export const createRaceEffects = (scene: ThreeScene, models: EffectModels): RaceEffects => {
  const brickPools = new Map(
    Object.entries(models.powerUpBricks).map(
      ([kind, model]) => [kind, createPool(scene, model)] as const
    )
  )
  const pools = {
    rocket: createPool(scene, models.rocket),
    barrel: createPool(scene, models.barrel),
    magnet: createPool(scene, models.magnet),
    spikedExplosion: createPool(scene, models.spikedExplosion),
    enhancementBrick: createPool(scene, models.enhancementBrick),
  }
  const portalPool = createPool(scene, models.warpPortal)
  const shieldPools = models.shields.map((model) => createPool(scene, model))
  const turboPools = models.turbos.map((figures) =>
    figures.map(({ model }) => createPool(scene, model))
  )
  return Object.freeze({
    update: (views: EffectViews, eye: Vector3Like, poses: readonly RacerPose[]) => {
      for (const pool of [
        ...Object.values(pools),
        ...brickPools.values(),
        ...shieldPools,
        ...turboPools.flat(),
        portalPool,
      ])
        pool.reset()
      for (const view of views.effects) {
        const pool =
          view.kind === 'rocket'
            ? pools.rocket
            : view.kind === 'barrel'
              ? pools.barrel
              : view.kind === 'magnet'
                ? pools.magnet
                : null
        if (pool === null) continue
        const copy = pool.use()
        copy.group.matrix.copy(getHeadingMatrix(view.heading, view.position))
        if (view.kind === 'rocket' && view.rotation !== null) {
          copy.group.matrix.copy(getFrameMatrix(view.rotation, view.position))
        }
        if (view.kind === 'rocket') {
          copy.object.setAnimationState(
            getEffectFigureState(models.rocketAnimations, {
              animationId: view.rocketIndex,
              isLooping: false,
              elapsedMilliseconds: view.isLaunching
                ? view.launchMilliseconds
                : getRocketLaunchMilliseconds(models.rocketAnimations, view.rocketIndex) + 1000,
            })
          )
        }
      }
      for (const brick of views.bricks) {
        if (!getIsWithinLevelDistance(brick.position, eye, BRICK_LEVEL_DISTANCE)) continue
        const pool = brick.isEnhancement ? pools.enhancementBrick : brickPools.get(brick.kind ?? '')
        if (pool === undefined) continue
        const copy = pool.use()
        copy.group.matrix
          .copy(getHeadingMatrix(null, brick.position))
          .multiply(new Matrix4().makeRotationZ(views.spinAngle))
          .multiply(new Matrix4().makeScale(brick.scale, brick.scale, brick.scale))
      }
      for (const attachment of views.attachments) {
        const pose = poses.find((candidate) => candidate.racerIndex === attachment.racerIndex)
        const pool = shieldPools[attachment.level]
        if (pose === undefined || pool === undefined || attachment.kind !== 'shield') continue
        const copy = pool.use()
        copy.group.matrix.copy(
          getFrameMatrix(
            getUprightRotation({ x: pose.rotation[0], y: pose.rotation[1], z: pose.rotation[2] }),
            { x: pose.position.x, y: pose.position.y, z: pose.position.z + SHIELD_HEIGHT }
          )
        )
        copy.object.setAnimationState(
          getEffectFigureState(models.shieldAnimations, {
            animationId: 0,
            isLooping: true,
            elapsedMilliseconds: attachment.elapsedMilliseconds,
          })
        )
      }
      for (const attachment of views.attachments) {
        if (attachment.kind !== 'warp') continue
        const pose = poses.find((candidate) => candidate.racerIndex === attachment.racerIndex)
        if (pose === undefined) continue
        const portal = portalPool.use()
        portal.group.matrix
          .copy(getFrameMatrix(pose.rotation, pose.position))
          .multiply(new Matrix4().makeScale(attachment.scale, attachment.scale, attachment.scale))
        const [scrollU, scrollV] = models.warpPortalScroll
        portal.group.traverse((object) => {
          if (object.type !== 'Mesh') return
          const { map } = (object as Mesh).material as MeshBasicMaterial
          map?.offset.set(
            getWrappedFraction(
              (scrollU * attachment.elapsedMilliseconds) / MILLISECONDS_PER_SECOND
            ),
            getWrappedFraction((scrollV * attachment.elapsedMilliseconds) / MILLISECONDS_PER_SECOND)
          )
        })
      }
      for (const attachment of views.attachments) {
        const pose = poses.find((candidate) => candidate.racerIndex === attachment.racerIndex)
        const figures = turboPools[attachment.level]
        const figureModels = models.turbos[attachment.level]
        if (pose === undefined || figures === undefined || figureModels === undefined) continue
        if (attachment.kind !== 'turbo') continue
        figures.forEach((pool, figureIndex) => {
          const isFlame = figureIndex > 0
          // 0x0045d150: the flames are drawn with alpha 0 until the last 50 ms of the starting state.
          if (isFlame && attachment.state === 'starting' && attachment.timerMilliseconds > 50)
            return
          const copy = pool.use()
          copy.group.matrix.copy(getFrameMatrix(getTurboRotation(pose), getTurboPosition(pose)))
          const animations = figureModels[figureIndex]?.animations
          if (animations !== undefined && attachment.state !== 'starting') {
            copy.object.setAnimationState(
              getEffectFigureState(animations, {
                animationId: attachment.state === 'active' ? 1 : 2,
                isLooping: true,
                elapsedMilliseconds: attachment.elapsedMilliseconds,
              })
            )
          }
        })
      }
      for (const explosion of views.explosions) {
        if (!explosion.isSpiked) continue
        const copy = pools.spikedExplosion.use()
        copy.group.matrix
          .copy(getHeadingMatrix(null, explosion.position))
          .multiply(new Matrix4().makeScale(explosion.scale, explosion.scale, explosion.scale))
      }
    },
    dispose: () => {
      for (const pool of [
        ...Object.values(pools),
        ...brickPools.values(),
        ...shieldPools,
        ...turboPools.flat(),
        portalPool,
      ])
        pool.dispose()
    },
  })
}
