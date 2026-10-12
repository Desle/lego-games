import type {
  AttachmentView,
  EffectViews,
  EffectView,
  RacerPose,
} from '@lego-games/lego-racers/race-presentation'
import type { Matrix3 } from '@lego-games/lego-racers/simulation-math'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { Scene as ThreeScene } from 'three'
import { Matrix4 } from 'three'
import type { Mesh, MeshBasicMaterial } from 'three'
import { BRICK_LEVEL_DISTANCE } from '@lego-games/lego-racers/race-presentation'
import type { FigureAnimation } from '@lego-games/lego-racers/racer'
import {
  ENHANCEMENT_BRICK_MODEL_NAME,
  POWER_UP_BRICK_MODEL_NAME,
} from '../../../../shared/viewer-extensions/effect-model-names.ts'
import type { EffectModelDrawingRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { Vector3Like } from '../race-viewport/race-viewport.types.ts'
import { getIsWithinLevelDistance } from '../scene-object/level-distance.ts'
import { getEffectFigureState } from '@lego-games/lego-racers/race-presentation'
import { setAlphaOverride } from '../scene-object/alpha-override.ts'
import { getReversedModel } from '../model-object/reverse-faces.ts'
import { getFrameMatrix, getUprightRotation } from '../frame-matrix/frame-matrix.ts'
import { showEffectModelDrawing } from '../effect-model-drawing/effect-model-drawing.ts'
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

// 0x0045d150 draws the two flames with the device's alpha override: 0 until the last 50 ms of the starting state, then
// 255; while the turbo ends it fades with the timer from 700 ms (191) to 350 ms (0). The active state draws them as modelled.
const TURBO_FLAME_VISIBLE_MILLISECONDS = 50
const TURBO_ENDING_FADE_MILLISECONDS = 350
const TURBO_ENDING_ALPHA_SCALE = new DataView(new Uint32Array([0x3b3b3ee7]).buffer).getFloat32(
  0,
  true
)
const TURBO_ALPHA_MAXIMUM = 255
// 0x004b0b4c: the fade's full scale, a flame ending is 191 at its most opaque.
const TURBO_ENDING_ALPHA_PEAK = 191
const getTurboFlameAlpha = (attachment: AttachmentView): number | null => {
  if (attachment.state === 'starting') {
    return attachment.timerMilliseconds <= TURBO_FLAME_VISIBLE_MILLISECONDS
      ? TURBO_ALPHA_MAXIMUM
      : 0
  }
  if (attachment.state !== 'ending') return null
  const fade = Math.max(attachment.timerMilliseconds - TURBO_ENDING_FADE_MILLISECONDS, 0)
  return Math.trunc(Math.fround(fade * TURBO_ENDING_ALPHA_SCALE) * TURBO_ENDING_ALPHA_PEAK)
}

// 0x00421850: the figure's scale grows from 0.05 (0x004b0148) to the explosion's end scale of 1 with the growth progress
// (never past 1) and its opacity falls from 255 to 0 with it.
const EXPLOSION_FIGURE_START_SCALE = 0.05
const EXPLOSION_FIGURE_END_SCALE = 1
const EXPLOSION_ALPHA_MAXIMUM = 255
const getExplosionFigureScale = (progress: number): number =>
  Math.min(
    Math.fround(
      Math.fround(EXPLOSION_FIGURE_END_SCALE - EXPLOSION_FIGURE_START_SCALE) * progress +
        EXPLOSION_FIGURE_START_SCALE
    ),
    1
  )
const getExplosionFigureAlpha = (progress: number): number =>
  Math.trunc(Math.max(Math.fround((1 - progress) * EXPLOSION_ALPHA_MAXIMUM), 0))

const MILLISECONDS_PER_SECOND = 1000
// Hypothesis, measured against the render trace (turbo levels 0 to 2): once the turbo is active its figures have advanced one
// frame more than the effect's timer shows, and their texture scroll runs about two frames behind it.
const TURBO_ANIMATION_LEAD_MILLISECONDS = 33
const TURBO_SCROLL_LAG_MILLISECONDS = 71
const setTextureScroll = (
  copy: ModelObject,
  scroll: readonly [number, number],
  elapsedMilliseconds: number
) => {
  const [scrollU, scrollV] = scroll
  copy.group.traverse((object) => {
    if (object.type !== 'Mesh') return
    const { map } = (object as Mesh).material as MeshBasicMaterial
    map?.offset.set(
      getWrappedFraction((scrollU * elapsedMilliseconds) / MILLISECONDS_PER_SECOND),
      getWrappedFraction((scrollV * elapsedMilliseconds) / MILLISECONDS_PER_SECOND)
    )
  })
}
// The scroll the original adds stays below 1 (it wraps).
const getWrappedFraction = (value: number): number => value - Math.floor(value)

// 0x0045cf90 sets the figures' orientation (slot 0x40, 0x00410900) from the display figure's second row and third row: the
// first row of the turbo's frame is the car's side, the second its backwards axis.
const getTurboRotation = (pose: RacerPose): Matrix3 => {
  const [forwardX, forwardY, forwardZ, sideX, sideY, sideZ, upX, upY, upZ] = pose.rotation
  return [sideX, sideY, sideZ, -forwardX, -forwardY, -forwardZ, upX, upY, upZ]
}

// A growing pool of one model: `use` shows the next free copy, `reset` hides them all. A viewer extension may draw the copies of
// a model it names (`drawingRequest`) in place of the original's.
const createPool = (
  scene: ThreeScene,
  model: ModelScene,
  drawingRequest: EffectModelDrawingRequest | null = null
) => {
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
        copy =
          drawingRequest === null
            ? createModelObject(model)
            : showEffectModelDrawing(createModelObject(model), drawingRequest)
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
      ([kind, model]) =>
        [
          kind,
          createPool(scene, model, { modelName: POWER_UP_BRICK_MODEL_NAME, variant: kind }),
        ] as const
    )
  )
  const pools = {
    rocket: createPool(scene, models.rocket),
    barrel: createPool(scene, models.barrel),
    magnet: createPool(scene, models.magnet),
    plainExplosion: createPool(scene, models.plainExplosion),
    spikedExplosion: createPool(scene, models.spikedExplosion),
    enhancementBrick: createPool(scene, models.enhancementBrick, {
      modelName: ENHANCEMENT_BRICK_MODEL_NAME,
      variant: null,
    }),
  }
  const portalPool = createPool(scene, models.warpPortal)
  const shieldPools = models.shields.map((model) => createPool(scene, model))
  const shieldBackPools = models.shields.map((model) => createPool(scene, getReversedModel(model)))
  const turboPools = models.turbos.map((figures) =>
    figures.map(({ model }) => createPool(scene, model))
  )
  return Object.freeze({
    update: (views: EffectViews, eye: Vector3Like, poses: readonly RacerPose[]) => {
      for (const pool of [
        ...Object.values(pools),
        ...brickPools.values(),
        ...shieldPools,
        ...shieldBackPools,
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
        if (pose === undefined || attachment.kind !== 'shield') continue
        // The shield figure is double-sided: its back faces are drawn, then its front faces.
        for (const pool of [shieldBackPools[attachment.level], shieldPools[attachment.level]]) {
          if (pool === undefined) continue
          const copy = pool.use()
          copy.group.matrix.copy(
            getFrameMatrix(
              getUprightRotation({ x: pose.rotation[0], y: pose.rotation[1], z: pose.rotation[2] }),
              { x: pose.position.x, y: pose.position.y, z: pose.position.z + SHIELD_HEIGHT }
            )
          )
          setTextureScroll(copy, models.shieldScroll, attachment.elapsedMilliseconds)
          copy.object.setAnimationState(
            getEffectFigureState(models.shieldAnimations, {
              animationId: 0,
              isLooping: true,
              elapsedMilliseconds: attachment.elapsedMilliseconds,
            })
          )
        }
      }
      for (const attachment of views.attachments) {
        if (attachment.kind !== 'warp') continue
        const pose = poses.find((candidate) => candidate.racerIndex === attachment.racerIndex)
        if (pose === undefined) continue
        const portal = portalPool.use()
        portal.group.matrix
          .copy(getFrameMatrix(pose.rotation, pose.position))
          .multiply(new Matrix4().makeScale(attachment.scale, attachment.scale, attachment.scale))
        setTextureScroll(portal, models.warpPortalScroll, attachment.elapsedMilliseconds)
      }
      for (const attachment of views.attachments) {
        const pose = poses.find((candidate) => candidate.racerIndex === attachment.racerIndex)
        const figures = turboPools[attachment.level]
        const figureModels = models.turbos[attachment.level]
        if (pose === undefined || figures === undefined || figureModels === undefined) continue
        if (attachment.kind !== 'turbo') continue
        figures.forEach((pool, figureIndex) => {
          const isFlame = figureIndex > 0
          const copy = pool.use()
          setAlphaOverride(copy.group, isFlame ? getTurboFlameAlpha(attachment) : null)
          copy.group.matrix.copy(getFrameMatrix(getTurboRotation(pose), getTurboPosition(pose)))
          const animations = figureModels[figureIndex]?.animations
          setTextureScroll(
            copy,
            figureModels[figureIndex]?.scroll ?? [0, 0],
            attachment.state === 'starting'
              ? attachment.elapsedMilliseconds
              : attachment.elapsedMilliseconds - TURBO_SCROLL_LAG_MILLISECONDS
          )
          if (animations !== undefined) {
            const isStarting = attachment.state === 'starting'
            copy.object.setAnimationState(
              getEffectFigureState(animations, {
                animationId: attachment.state === 'ending' ? 2 : isStarting ? 0 : 1,
                isLooping: attachment.state !== 'ending',
                elapsedMilliseconds:
                  attachment.elapsedMilliseconds +
                  (isStarting ? 0 : TURBO_ANIMATION_LEAD_MILLISECONDS),
              })
            )
          }
        })
      }
      for (const explosion of views.explosions) {
        // 0x00421ae0: only a growing explosion draws its figure; a fading one leaves its scar (a decal).
        if (explosion.isFading) continue
        const copy = (explosion.isSpiked ? pools.spikedExplosion : pools.plainExplosion).use()
        const scale = getExplosionFigureScale(explosion.progress)
        copy.group.matrix
          .copy(getHeadingMatrix(null, explosion.position))
          .multiply(new Matrix4().makeScale(scale, scale, scale))
        setAlphaOverride(copy.group, getExplosionFigureAlpha(explosion.progress))
      }
    },
    dispose: () => {
      for (const pool of [
        ...Object.values(pools),
        ...brickPools.values(),
        ...shieldPools,
        ...shieldBackPools,
        ...turboPools.flat(),
        portalPool,
      ])
        pool.dispose()
    },
  })
}
