// The dev server's route to upscaled texture packs (`LEGO_HD_TEXTURES_ROOT`, by default `~/textures/lego-racers`):
// `<variant>/<archive path>.png`. Only `?hd=<variant>` in development asks for them; the original files stay untouched.
export const DEVELOPMENT_HIGH_DEFINITION_ROUTE = '/__development/high-definition'
