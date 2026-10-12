// The dev server's route to the developer's local LEGO.JAM (vite.config.ts); production builds never call it.
export const DEVELOPMENT_JAM_ROUTE = '/__development/lego.jam'

// The dev server's route to the other original files a race needs: `LEGORacers.exe` and the `.tun` music.
export const DEVELOPMENT_GAME_FILE_ROUTE = '/__development/game-files'

// The dev server's route to upscaled texture packs (`LEGO_HD_TEXTURES_ROOT`, by default `~/textures/lego-racers`):
// `<variant>/<archive path>.png`. Only `?hd=<variant>` in development asks for them; the original files stay untouched.
export const DEVELOPMENT_HIGH_DEFINITION_ROUTE = '/__development/high-definition'
