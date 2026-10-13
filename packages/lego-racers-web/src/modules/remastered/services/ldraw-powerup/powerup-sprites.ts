import type { PowerUpSprite } from './powerup-sprites.types.ts'

// The power-up visuals the race draws as a camera-facing sprite, not a POWERUP.WDB model, by the name of their file
// (`powerups/<NAME>.ldr`). Only the cannon ball is one: 0x00451a50 gives it the material "cannon" (POWERUP.MDB) and a sprite of 5
// by 5 (0x004b13a0). The grapple's rope and the wand's beam are ribbons, a plain explosion is emitter particles.
export const POWER_UP_SPRITES: Readonly<Record<string, PowerUpSprite>> = Object.freeze({
  CANNONBALL: Object.freeze({
    materialName: 'cannon',
    directory: 'GAMEDATA\\COMMON',
    library: 'POWERUP',
    width: 5,
    height: 5,
  }),
})

export const POWER_UP_SPRITE_NAMES: readonly string[] = Object.freeze(Object.keys(POWER_UP_SPRITES))

// The sprite drawn with a material, by its file name; undefined for a material that is no power-up sprite.
export const findPowerUpSpriteName = (materialName: string): string | undefined =>
  POWER_UP_SPRITE_NAMES.find((name) => POWER_UP_SPRITES[name]?.materialName === materialName)
