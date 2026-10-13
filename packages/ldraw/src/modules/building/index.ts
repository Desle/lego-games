export {
  formatPartLine,
  getDefaultHeaderLines,
  getReferencedModelName,
  inlineReferencedModels,
  parseBuilderDocument,
  parsePartLine,
  rotateVector,
  serializeBuilderDocument,
  turnQuarter,
} from './services/builder-document/builder-document.ts'
export {
  applyConnectionSnap,
  findConnectionSnap,
} from './services/builder-connection-snap/builder-connection-snap.ts'
export type {
  ConnectionSnap,
  ConnectionSnapOptions,
} from './services/builder-connection-snap/builder-connection-snap.types.ts'
export {
  getMinifigConnections,
  getPartConnections,
} from './services/builder-connections/builder-connections.ts'
export { ConnectionKind } from './services/builder-connections/builder-connections.types.ts'
export type {
  ConnectedPart,
  PartConnection,
} from './services/builder-connections/builder-connections.types.ts'
export {
  getDominantAxis,
  getIsAlongAxis,
  getIsVertical,
  getPlateOffset,
  getRayHeight,
  lockToAxis,
} from './services/builder-drag/builder-drag.ts'
export {
  addParts,
  getSameColorIndices,
  getStudOffset,
  getStudStep,
  moveParts,
  pickParts,
  recolorParts,
  removeParts,
  tiltParts,
  toggleIndex,
  turnParts,
} from './services/builder-editing/builder-editing.ts'
export {
  createBuilderHistory,
  pushBuilderHistory,
  redoBuilderHistory,
  undoBuilderHistory,
} from './services/builder-history/builder-history.ts'
export {
  findSideStud,
  getGridPoint,
  getGroundPhase,
  getPartBottom,
  getPartPhase,
  getPlacedBox,
  getPlacedStuds,
  getPlacementPosition,
  getRotatedBox,
  getSideStudPosition,
  getTopGridPoint,
} from './services/builder-placement/builder-placement.ts'
export { getFacingRotation, turnAbout } from './services/builder-rotation/builder-rotation.ts'
export {
  createPartShapes,
  createPartStudLists,
  findModelFacePoints,
  findPartShape,
} from './services/builder-studs/builder-studs.ts'
export type {
  PartShape,
  PartStud,
  PartStudLists,
} from './services/builder-studs/builder-studs.types.ts'
export { addVectors, getVectorDifference } from './services/builder-vectors/builder-vectors.ts'
export { PLATE_HEIGHT, STUD_WIDTH } from './services/ldraw-units/ldraw-units.constants.ts'
export {
  createLibraryFileReader,
  createServedLibraryReader,
} from './services/library-file-reader/library-file-reader.ts'
export type {
  LibraryFileReader,
  LibraryTextReader,
} from './services/library-file-reader/library-file-reader.types.ts'
export type {
  BuilderBox,
  BuilderDocument,
  BuilderHistory,
  BuilderPart,
  BuilderPartLine,
  PlacementTarget,
  Vector,
} from './types/building.types.ts'
