import { getModelBounds, parseModel } from '../../../model/index.ts'
import type { FigureBounds } from '../../../racer/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { DRIVER_ANIMATION_NAME } from '../../types/racer-appearance-names.ts'
import type {
  FigureSource,
  ModelResourceNames,
  RacerAppearance,
  RacerFigureSources,
} from '../../types/racer-appearance.types.ts'

// RacerSet_Setup 0x0043b190 makes GAMEDATA\COMMON the archive's directory before it loads any of these (0x0042c4e0).
export const RACER_FILE_DIRECTORY = 'GAMEDATA\\COMMON'
const SEPARATOR = '\\'

export const getRacerFilePath = (name: string, extension: string): string =>
  `${RACER_FILE_DIRECTORY}${SEPARATOR}${name.toUpperCase()}.${extension}`

const getFigureSource = (
  readFile: (path: string) => Uint8Array,
  animationName: string,
  modelName: string
): FigureSource =>
  Object.freeze({
    animationBytes: readFile(getRacerFilePath(animationName, 'ADB')),
    modelScale: parseModel(readFile(getRacerFilePath(modelName, 'GDB'))).scale,
  })

const getModelSource = (
  readFile: (path: string) => Uint8Array,
  model: ModelResourceNames
): FigureSource => getFigureSource(readFile, model.animationName, model.modelName)

// The bounding sphere of a champion's car body model (0x100278c0, run when the model loads).
const getBodyBounds = (
  arithmetic: FloatArithmetic,
  readFile: (path: string) => Uint8Array,
  model: ModelResourceNames | null
): FigureBounds | null =>
  model === null
    ? null
    : getModelBounds(arithmetic, parseModel(readFile(getRacerFilePath(model.modelName, 'GDB'))))

// The animation sets and model scales a racer's wheel and driver figures are made of (Chassis_CreateInstances
// 0x0041e360, Driver_CreateInstance 0x00420ef0), read from GAMEDATA\COMMON. A car built from bricks has no driver
// model in the databases: its figure uses the pelvis animation set with the scale `builtDriverScale` of the model the
// figure builder made.
export const loadRacerFigureSources = (
  arithmetic: FloatArithmetic,
  readFile: (path: string) => Uint8Array,
  appearance: RacerAppearance,
  builtDriverScale: number
): RacerFigureSources =>
  Object.freeze({
    bodyBounds: getBodyBounds(arithmetic, readFile, appearance.bodyModel),
    wheels: getModelSource(readFile, appearance.wheelModel),
    secondWheels:
      appearance.secondWheelModel === null
        ? null
        : getModelSource(readFile, appearance.secondWheelModel),
    driver:
      appearance.driverModel === null
        ? Object.freeze({
            animationBytes: readFile(getRacerFilePath(DRIVER_ANIMATION_NAME, 'ADB')),
            modelScale: builtDriverScale,
          })
        : getModelSource(readFile, appearance.driverModel),
  })
