import {
  getTruncatedInteger,
  createFloatArithmetic,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type {
  HudCommand,
  HudHeldKindIcon,
  HudImageCommand,
  HudInput,
  HudPoint,
} from '../../types/race-hud.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// Image database entries (LEGOIMGS.IDB, 0x00426eef..0x00427058): the holder, its tinted frame, and the first icon of
// each held kind; the icon is that entry plus the racer's level (+0xd58). Level 1..3 also draws entry 12 + level.
const HOLDER_IMAGE_INDEX = 0xb
const HOLDER_FRAME_IMAGE_INDEX = 0xc
const LEVEL_OVERLAY_BASE_INDEX = 0xc
// Racer +0xccc: 1 projectile, 2 shield, 3 turbo, 4 hazard.
const HELD_KIND_ICONS: Readonly<Record<number, HudHeldKindIcon>> = Object.freeze({
  1: Object.freeze({ imageBase: 2, color: 0xff0000ff }),
  2: Object.freeze({ imageBase: 0x10, color: 0xffff5050 }),
  3: Object.freeze({ imageBase: 0x14, color: 0xff00ff00 }),
  4: Object.freeze({ imageBase: 6, color: 0xff00ffff }),
})

// The holder at the bottom left with the held power-up's icon in it and, from level 1, the level overlay.
export const getHeldPowerUpCommands = (input: HudInput): readonly HudCommand[] => {
  const { layout, racer } = input
  const icon = HELD_KIND_ICONS[racer.heldPowerUp.kindCode]
  const { level } = racer.heldPowerUp
  if (icon === undefined && level === 0) return []
  const getImage = (
    imageIndex: number,
    position: HudPoint,
    color: number | null
  ): HudImageCommand | null => {
    const imageName = input.imageNames[imageIndex]
    const size = imageName === undefined ? null : input.getImageSize(imageName)
    if (imageName === undefined || size === null) return null
    return {
      kind: 'image',
      imageIndex,
      imageName,
      x: position.x,
      y: position.y,
      width: getTruncatedInteger(arithmetic.multiply(size.width, layout.horizontalScale)),
      height: getTruncatedInteger(arithmetic.multiply(size.height, layout.verticalScale)),
      color,
    }
  }
  const origin = { x: layout.holderX, y: layout.holderY }
  const holder = getImage(HOLDER_IMAGE_INDEX, origin, null)
  const frame = getImage(HOLDER_FRAME_IMAGE_INDEX, origin, icon?.color ?? 0xffffffff)
  if (holder === null || frame === null) return []
  const iconImage =
    icon === undefined ? null : getImage(icon.imageBase + level, { x: 0, y: 0 }, null)
  const placedIcon: HudImageCommand | null =
    iconImage === null
      ? null
      : {
          ...iconImage,
          x: origin.x + ((holder.width * 31) >> 6) - (iconImage.width >> 1),
          y: origin.y + ((holder.height * 38) >> 6) - (iconImage.height >> 1),
        }
  const overlay =
    level === 0
      ? null
      : getImage(
          LEVEL_OVERLAY_BASE_INDEX + level,
          { x: origin.x + ((holder.width * 24) >> 6), y: origin.y },
          null
        )
  return [holder, frame, placedIcon, overlay].filter((command) => command !== null)
}
