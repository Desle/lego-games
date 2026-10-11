import type { ModelFiles } from '../../../scene/index.ts'
import { RACER_FILE_DIRECTORY } from '../../services/load-racer-figures/load-racer-figures.ts'
import type { ModelResourceNames } from '../../types/racer-appearance.types.ts'

// The files of a thing a racer is drawn from (RacerSet_SetupRacer 0x0043b480): all in GAMEDATA\COMMON, the skeleton and the
// animation only when the record names them.
export const getRacerModelFiles = (names: ModelResourceNames): ModelFiles => ({
  directory: RACER_FILE_DIRECTORY,
  textureNames: [names.textureDatabaseName.toUpperCase()],
  materialNames: [names.materialLibraryName.toUpperCase()],
  meshNames: [names.modelName.toUpperCase()],
  skeletonName: names.skeletonName === '' ? null : names.skeletonName.toUpperCase(),
  animationName: names.animationName === '' ? null : names.animationName.toUpperCase(),
})
