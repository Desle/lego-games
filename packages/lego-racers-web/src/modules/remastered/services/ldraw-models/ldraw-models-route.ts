// The dev server's route to the player's hand-built racer models (`LEGO_LDRAW_MODELS_ROOT`, by default `~/ldraw-models`): a car by
// its body code in `<CODE>.ldr` or `<CODE>.mpd`, a chassis recipe in `chassis/<CHASSIS>.ldr`. `index.json` lists what is there.
export const DEVELOPMENT_LDRAW_MODELS_ROUTE = '/__development/ldraw-models'
export const LDRAW_MODEL_INDEX_FILE = 'index.json'
export const LDRAW_CHASSIS_FOLDER = 'chassis'
export const LDRAW_MODEL_EXTENSIONS: readonly string[] = ['.ldr', '.mpd']
