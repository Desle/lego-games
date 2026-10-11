export {
  findBrickPiece,
  findBrickPieceByName,
  parseBrickDatabase,
} from './controller/parse-brick-database/parse-brick-database.ts'
export {
  COLOR_NAME_LENGTH,
  findBrickColorIndex,
  getBrickColorMaterialIndices,
  parseBrickColors,
} from './controller/parse-brick-colors/parse-brick-colors.ts'
export { parseCarSet, parseCarSetFileNames } from './controller/parse-car-sets/parse-car-sets.ts'
export {
  BUILD_GRID_HEIGHT,
  BUILD_GRID_WIDTH,
  createBuildGrid,
  getFootprintCell,
  getFootprintHeight,
  getGridWithBrick,
  getOrientedSize,
  getOverlapCount,
  getPlacement,
  getRestingHeight,
  MAXIMUM_BRICK_COUNT,
} from './controller/build-grid/build-grid.ts'
export {
  BRICK_RECORD_BYTE_COUNT,
  loadCarDesign,
  MAXIMUM_BUILD_HEIGHT,
} from './controller/load-car-design/load-car-design.ts'
export {
  buildCarGeometry,
  getBrickFaces,
} from './controller/build-car-geometry/build-car-geometry.ts'
export { getCarWeight } from './controller/get-car-weight/get-car-weight.ts'
export { getDriverPartBytes } from './controller/get-driver-part-bytes/get-driver-part-bytes.ts'
export type {
  BrickColor,
  BrickDatabase,
  BrickFootprint,
  BrickPiece,
  BuildGrid,
  CarDesign,
  CarFace,
  CarGeometry,
  CarGeometryBatch,
  CarVertex,
  CarSet,
  CarSetBrick,
  CarWeight,
  GridCell,
  PlacedBrick,
  PlacementResult,
} from './types/car-builder.types.ts'
export {
  BRICK_DATABASE_PATH,
  DEFAULT_SAVE_PATH,
  loadSavedCars,
  QUICK_BUILD_SAVE_PATH,
} from './controller/load-saved-cars/load-saved-cars.ts'
export type { SavedCar } from './types/save-file.types.ts'
