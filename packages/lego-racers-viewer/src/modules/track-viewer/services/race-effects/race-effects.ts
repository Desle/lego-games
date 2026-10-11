import type { EffectViews, EffectView } from '@lego-games/lego-racers/race-presentation'
import type { ModelScene } from '@lego-games/lego-racers/scene'
import type { Scene as ThreeScene } from 'three'
import { Matrix4 } from 'three'
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
  const brickPools = Object.fromEntries(
    Object.entries(models.powerUpBricks).map(([kind, model]) => [kind, createPool(scene, model)])
  )
  const pools = {
    rocket: createPool(scene, models.rocket),
    barrel: createPool(scene, models.barrel),
    magnet: createPool(scene, models.magnet),
    spikedExplosion: createPool(scene, models.spikedExplosion),
    enhancementBrick: createPool(scene, models.enhancementBrick),
  }
  return Object.freeze({
    update: (views: EffectViews) => {
      for (const pool of [...Object.values(pools), ...Object.values(brickPools)]) pool.reset()
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
        pool.use().group.matrix.copy(getHeadingMatrix(view.heading, view.position))
      }
      for (const brick of views.bricks) {
        const brickPool = brick.isEnhancement
          ? pools.enhancementBrick
          : brickPools[brick.kind ?? '']
        if (brickPool === undefined) continue
        const copy = brickPool.use()
        copy.group.matrix
          .copy(getHeadingMatrix(null, brick.position))
          .multiply(new Matrix4().makeRotationZ(views.spinAngle))
          .multiply(new Matrix4().makeScale(brick.scale, brick.scale, brick.scale))
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
      for (const pool of [...Object.values(pools), ...Object.values(brickPools)]) pool.dispose()
    },
  })
}
