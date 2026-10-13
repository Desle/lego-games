import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import type {
  RaceDisplay,
  StageSize,
  WindowMetrics,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type { HudMargins } from './widescreen-display.types.ts'

const ORIGINAL_ASPECT_RATIO = 4 / 3
// The most pixels the race renders, about 2560 x 1440: beyond it the screen's own scaling is cheaper than drawing
// more, which matters most on phones and tablets with a device pixel ratio of 2 or 3.
export const RENDER_PIXEL_BUDGET = 2560 * 1440
const MINIMUM_PIXEL_RATIO = 0.5

// The device pixel ratio, lowered until the window's pixels fit the budget.
export const getBudgetedPixelRatio = (window: WindowMetrics, budget: number): number => {
  const windowPixels = Math.max(window.innerWidth * window.innerHeight, 1)
  const ratio = Math.min(window.devicePixelRatio, Math.sqrt(budget / windowPixels))
  return Math.max(ratio, MINIMUM_PIXEL_RATIO)
}

// The biggest 4:3 area that fits the window: the HUD is laid out for it, at the window's own resolution.
export const getHudDesignSize = (window: WindowMetrics): StageSize => {
  const height = Math.min(window.innerHeight, Math.floor(window.innerWidth / ORIGINAL_ASPECT_RATIO))
  return Object.freeze({ width: Math.round(height * ORIGINAL_ASPECT_RATIO), height })
}

// The HUD keeps its 4:3 layout; what the original anchors to the right or bottom edge moves with that edge, what it
// centres moves with the centre, and what it anchors to the left or top stays.
export const getHudOffsetCommand = (
  command: HudCommand,
  design: StageSize,
  margins: HudMargins
): HudCommand => {
  const getOffsetX = (x: number, width: number): number => {
    const center = x + width / 2
    if (center > (design.width * 2) / 3) return margins.right
    return center < design.width / 3 ? 0 : margins.right / 2
  }
  const getOffsetY = (y: number, height: number): number =>
    y + height / 2 > design.height / 2 ? margins.bottom : 0
  switch (command.kind) {
    case 'text':
      return {
        ...command,
        x: command.x + getOffsetX(command.x, 0),
        y: command.y + getOffsetY(command.y, 0),
      }
    case 'fill': {
      const isFullWidth = command.x <= 0 && command.x + command.width >= design.width
      const isFullHeight = command.y <= 0 && command.y + command.height >= design.height
      return {
        ...command,
        width: isFullWidth ? command.width + margins.right : command.width,
        height: isFullHeight ? command.height + margins.bottom : command.height,
        x: isFullWidth ? command.x : command.x + getOffsetX(command.x, command.width),
        y: isFullHeight ? command.y : command.y + getOffsetY(command.y, command.height),
      }
    }
    case 'image':
    case 'image_part':
      return {
        ...command,
        x: command.x + getOffsetX(command.x, command.width),
        y: command.y + getOffsetY(command.y, command.height),
      }
    case 'polygon': {
      const xs = command.vertices.map((vertex) => vertex.x)
      const ys = command.vertices.map((vertex) => vertex.y)
      const offsetX = getOffsetX(Math.min(...xs), Math.max(...xs) - Math.min(...xs))
      const offsetY = getOffsetY(Math.min(...ys), Math.max(...ys) - Math.min(...ys))
      const [first, second, third] = command.vertices
      const move = (vertex: typeof first) => ({
        ...vertex,
        x: vertex.x + offsetX,
        y: vertex.y + offsetY,
      })
      return { ...command, vertices: [move(first), move(second), move(third)] }
    }
  }
}

// The race fills the whole window at the display's native resolution, within the pixel budget. The camera keeps the original's vertical field
// of view (the stage's aspect widens the horizontal one) and the HUD sits on the window's corners.
export const getWidescreenDisplay = (window: WindowMetrics): RaceDisplay => {
  const design = getHudDesignSize(window)
  const margins: HudMargins = {
    right: window.innerWidth - design.width,
    bottom: window.innerHeight - design.height,
  }
  return Object.freeze({
    stageSize: Object.freeze({ width: window.innerWidth, height: window.innerHeight }),
    pixelRatio: getBudgetedPixelRatio(window, RENDER_PIXEL_BUDGET),
    hudDesignSize: design,
    isFullWindow: true,
    getHudCommands: (commands: readonly HudCommand[]) =>
      commands.map((command) => getHudOffsetCommand(command, design, margins)),
  })
}
