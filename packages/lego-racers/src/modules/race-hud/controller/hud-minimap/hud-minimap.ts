import {
  createFloatArithmetic,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type {
  HudCommand,
  HudImagePartCommand,
  HudLayout,
  HudMapPoint,
  HudMinimap,
  HudPolygonCommand,
  HudVertex,
} from '../../types/race-hud.types.ts'

const { add, subtract, multiply, divide, getSquareRoot, storeFloat } =
  createFloatArithmetic(RACE_FPU_PRECISION)

// 0x004b02b4: the dots' size in design pixels; 0x004b02b0 = 1 / 32 the margin; 0x004b02ac the map's size.
const DOT_SIZE = 16
const MARGIN_FRACTION = 0.03125
const MAP_SIZE = 128
// 0x3f7fbe77: the largest coordinate the map's picture is addressed with.
const MAP_COORDINATE_LIMIT = Math.fround(0.99899)
const MAP_COLOR = 0xc8ffffff
const OUTER_ARROW_COLOR = 0xff000000
const INNER_ARROW_COLOR = 0xff00ff00
// The image database's entry 10 (`igdcrdot`): 16 pixel cells, the second column for the special racer.
const DOT_IMAGE_INDEX = 10
const DOT_IMAGE_NAME = 'igdcrdot'
const DOT_CELL = 16
const SPECIAL_DOT_RACER_INDEX = 1
// 0x004b02a8, 0x004b02a4, 0x004b02a0 (the outer arrow) and 0x004b0098, 0x004af674, 0x004b0170 (the inner one).
const OUTER_ARROW = [9.5, 5.5, 6.5] as const
const INNER_ARROW = [8, 4, 5] as const

const getPolygon = (
  imageName: string | null,
  first: HudVertex,
  second: HudVertex,
  third: HudVertex
): HudPolygonCommand => {
  const polygon: HudPolygonCommand = {
    kind: 'polygon',
    imageName,
    vertices: [first, second, third],
  }
  return Object.freeze(polygon)
}

const getVertex = (x: number, y: number, u: number, v: number, color: number): HudVertex =>
  Object.freeze({ x, y, u, v, color })

// 0x004247d0: the arrow at (`x`, `y`) pointing along (`directionX`, `directionY`): a black triangle with a green one on it.
const getArrow = (
  layout: HudLayout,
  x: number,
  y: number,
  directionX: number,
  directionY: number
): readonly HudPolygonCommand[] => {
  const getCorners = ([tip, side, back]: readonly [number, number, number]) => {
    const tipX = storeFloat(multiply(directionX, tip))
    const tipY = storeFloat(multiply(directionY, tip))
    const sideSecond = storeFloat(multiply(directionY, side))
    const sideFirst = storeFloat(multiply(directionX, back))
    const backFirst = storeFloat(multiply(directionY, back))
    const backSecond = storeFloat(multiply(directionX, side))
    return [
      [tipX, tipY],
      [storeFloat(subtract(sideSecond, sideFirst)), storeFloat(subtract(-backFirst, backSecond))],
      [storeFloat(subtract(-sideFirst, sideSecond)), storeFloat(subtract(backSecond, backFirst))],
    ] as const
  }
  const getPlaced = ([cornerX, cornerY]: readonly [number, number], color: number): HudVertex =>
    getVertex(
      storeFloat(add(multiply(cornerX, layout.horizontalScale), x)),
      storeFloat(add(multiply(cornerY, layout.verticalScale), y)),
      0,
      0,
      color
    )
  const getTriangle = (corners: ReturnType<typeof getCorners>, color: number): HudPolygonCommand =>
    getPolygon(
      null,
      getPlaced(corners[0], color),
      getPlaced(corners[1], color),
      getPlaced(corners[2], color)
    )
  return [
    getTriangle(getCorners(OUTER_ARROW), OUTER_ARROW_COLOR),
    getTriangle(getCorners(INNER_ARROW), INNER_ARROW_COLOR),
  ]
}

// The minimap of 0x004249b0 for HUD display mode 1 (the whole screen, scales 1.0 apart from the layout's): the map picture
// as two triangles at the screen's bottom right, a dot for every other racer, and the player's arrow. Not ported: the
// clipping of 0x00423fc0 to the screen (the map lies on it), and the two extra dots of a second object
// (HUD `+0x30`, flags `+0x3b4`) that no race has.
export const getMinimapCommands = (
  layout: HudLayout,
  minimap: HudMinimap
): readonly HudCommand[] => {
  const dotWidth = getTruncatedInteger(multiply(layout.horizontalScale, DOT_SIZE))
  const dotHeight = getTruncatedInteger(multiply(layout.verticalScale, DOT_SIZE))
  const margin = multiply(layout.screenHeight, MARGIN_FRACTION)
  const bottom = layout.screenHeight - getTruncatedInteger(multiply(layout.verticalScale, margin))
  const right = layout.screenWidth - getTruncatedInteger(multiply(layout.horizontalScale, margin))
  const [boundsLeft, boundsRight, boundsTop, boundsBottom] = minimap.displayBounds
  // The world coordinates the map's edges stand for: +0x120, +0x11c, +0x128 and +0x124.
  const worldLeft = boundsLeft
  const worldRight = boundsRight
  const worldX = boundsTop
  const worldTop = minimap.isMirrored ? -worldRight : boundsBottom
  const extentX = subtract(boundsTop, worldLeft)
  const extentY = subtract(boundsRight, boundsBottom)
  const scale = storeFloat(divide(MAP_SIZE, extentX > extentY ? extentX : extentY))
  const scaleX = storeFloat(multiply(layout.horizontalScale, scale))
  const scaleY = storeFloat(multiply(layout.verticalScale, scale))
  const commands: HudCommand[] = []
  if (minimap.mapImageName !== null) {
    const left = storeFloat(add(multiply(subtract(worldLeft, boundsTop), scaleX), right))
    const top = storeFloat(add(multiply(subtract(boundsBottom, worldRight), scaleY), bottom))
    const topV = minimap.isMirrored ? 0 : MAP_COORDINATE_LIMIT
    const bottomV = minimap.isMirrored ? MAP_COORDINATE_LIMIT : 0
    const topLeft = getVertex(left, top, 0, topV, MAP_COLOR)
    const topRight = getVertex(right, top, MAP_COORDINATE_LIMIT, topV, MAP_COLOR)
    const bottomRight = getVertex(right, bottom, MAP_COORDINATE_LIMIT, bottomV, MAP_COLOR)
    const bottomLeft = getVertex(left, bottom, 0, bottomV, MAP_COLOR)
    commands.push(
      getPolygon(minimap.mapImageName, topLeft, topRight, bottomLeft),
      getPolygon(minimap.mapImageName, bottomLeft, topRight, bottomRight)
    )
  }
  const getOffset = (position: HudMapPoint): HudMapPoint => ({
    x: getTruncatedInteger(multiply(subtract(position.x, worldX), scaleX)),
    y: getTruncatedInteger(multiply(subtract(worldTop, position.y), scaleY)),
  })
  for (let index = minimap.racers.length - 1; index >= 0; index -= 1) {
    const racer = minimap.racers[index]
    if (racer === undefined || index === minimap.ownIndex) continue
    const offset = getOffset(racer.position)
    const sourceLeft = racer.isComputer && index === SPECIAL_DOT_RACER_INDEX ? DOT_CELL : 0
    const dot: HudImagePartCommand = {
      kind: 'image_part',
      imageIndex: DOT_IMAGE_INDEX,
      imageName: DOT_IMAGE_NAME,
      x: offset.x + (right - (dotWidth >> 1)),
      y: offset.y + (bottom - (dotHeight >> 1)),
      width: dotWidth,
      height: dotHeight,
      source: [sourceLeft, 0, sourceLeft + DOT_CELL, DOT_CELL],
    }
    commands.push(Object.freeze(dot))
  }
  const own = minimap.racers[minimap.ownIndex]
  if (own !== undefined) {
    const offset = getOffset(own.position)
    const { x: headingX, y: headingY } = minimap.ownHeading
    const inverseLength = storeFloat(
      divide(1, getSquareRoot(add(multiply(headingY, headingY), multiply(headingX, headingX))))
    )
    commands.push(
      ...getArrow(
        layout,
        right + offset.x,
        bottom + offset.y,
        storeFloat(multiply(headingX, inverseLength)),
        -storeFloat(multiply(headingY, inverseLength))
      )
    )
  }
  return commands
}
