export { DetailSwitch, setIsShadowRenderActive } from './services/detail-switch/detail-switch.ts'
export {
  createDetailedModel,
  createMaterialSet,
  instantiateModel,
} from './services/detailed-model/detailed-model.ts'
export type {
  DetailedModel,
  DetailedModelSettings,
  MaterialSet,
} from './services/detailed-model/detailed-model.types.ts'
export { disposeObject } from './services/dispose-object/dispose-object.ts'
export { setUpModelParser } from './services/ldraw-parse/ldraw-parse-client.ts'
export { listenForParseRequests } from './services/ldraw-parse/ldraw-parse-listener.ts'
export type {
  ModelParserSettings,
  SplitSubModel,
  SubModelSplitter,
} from './services/ldraw-parse/ldraw-parse.types.ts'
export { getIsMaterial, getIsMesh } from './services/object-guards/object-guards.ts'
export { holdPreparedModel } from './services/prepared-model/prepared-model.ts'
export { PreparedModelKind } from './services/prepared-model/prepared-model.types.ts'
export type {
  PreparedModel,
  PreparedModelHold,
} from './services/prepared-model/prepared-model.types.ts'
