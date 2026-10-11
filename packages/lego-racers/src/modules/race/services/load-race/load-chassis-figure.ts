import { parseAnimation } from '../../../animation/index.ts'
import type { Chassis } from '../../../chassis-database/index.ts'
import { parseModel } from '../../../model/index.ts'
import { createFigure, playFigureAnimation } from '../../../racer/index.ts'
import type { Figure, FigureAnimation } from '../../../racer/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'

// 0x0043d7a0 starts the display figure's first animation and sets flag 0x10000 (the figure plays).
const FIGURE_PLAYS_FLAG = 0x10000
const FIRST_ANIMATION_INDEX = 0
const RESOURCE_FOLDER = 'GAMEDATA\\COMMON'

// The car's display figure (racer +0x5c, vehicle +0x44) as 0x0041e360 builds it from the first variant of the chassis
// record: the model (keyword 0x36) is the figure's model part, whose scale (GDB keyword 0x33, default 1.0) scales
// the bounds; the animation file (0x38) gives one entry per clip, with the clip's rate, velocity and the bounding
// sphere (clip keyword 0x31: centre and radius) that 0x0040e0b0 reads while the figure plays. 0x0043d7a0 then plays
// clip 0. The model's own bounding sphere (0x100278c0) is only read while the figure does not play, so it is not
// computed.
export const loadChassisFigure = (
  readFile: (path: string) => Uint8Array,
  chassis: Chassis
): Figure => {
  const variant = chassis.variants[0]
  if (variant === undefined)
    throw new RangeError(`The chassis ${chassis.name} has no model variant`)
  const model = parseModel(readFile(`${RESOURCE_FOLDER}\\${variant.modelName.toUpperCase()}.GDB`))
  const animation = parseAnimation(
    readFile(`${RESOURCE_FOLDER}\\${variant.animationName.toUpperCase()}.ADB`)
  )
  const animations = animation.keyword2cEntries.map((clip): FigureAnimation =>
    Object.freeze({
      rate: clip.keyword2fValue,
      vector: Object.freeze({
        x: clip.keyword30Values[0],
        y: clip.keyword30Values[1],
        z: clip.keyword30Values[2],
      }),
      boundsCentre: Object.freeze({
        x: clip.keyword31Values[0],
        y: clip.keyword31Values[1],
        z: clip.keyword31Values[2],
      }),
      boundsRadius: clip.keyword31Values[3],
      frameCount: clip.keyword2dValue,
      period: clip.keyword2eValue,
    })
  )
  const figure = createFigure(animations, {
    centre: ZERO_VECTOR3,
    radius: 0,
    radiusScale: model.scale,
  })
  const playing = playFigureAnimation(figure, FIRST_ANIMATION_INDEX)
  return Object.freeze({ ...playing, flags: playing.flags | FIGURE_PLAYS_FLAG })
}
