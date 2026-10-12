// The dev server's route to the developer's local LEGO.JAM (vite.config.ts); production builds never call it.
export const DEVELOPMENT_JAM_ROUTE = '/__development/lego.jam'

// The dev server's route to the other original files a race needs: `LEGORacers.exe` and the `.tun` music.
export const DEVELOPMENT_GAME_FILE_ROUTE = '/__development/game-files'

// The dev server's route to an upscaled texture pack (`LEGO_HD_TEXTURES_PATH`, by default `~/lego-racers-textures-hd`):
// PNGs at the archive path of each bitmap. Only `?hd` in development asks for them; the original files stay untouched.
export const DEVELOPMENT_HIGH_DEFINITION_ROUTE = '/__development/high-definition'
