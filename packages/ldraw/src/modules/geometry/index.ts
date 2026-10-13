export { DetailSwitch, setIsShadowRenderActive } from './services/detail-switch/detail-switch.ts'
export { createDetailedBody } from './services/detailed-body/detailed-body.ts'
export {
  createDetailedPart,
  createMaterialSet,
  getPreparedModel,
  instantiateModel,
} from './services/detailed-model/detailed-model.ts'
export type { MaterialSet } from './services/detailed-model/detailed-model.types.ts'
export { disposeObject } from './services/dispose-object/dispose-object.ts'
export { setUpModelParser } from './services/ldraw-parse/ldraw-parse-client.ts'
export { listenForParseRequests } from './services/ldraw-parse/ldraw-parse-listener.ts'
export type {
  ModelParserSettings,
  SplitSubModel,
  SubModelSplitter,
} from './services/ldraw-parse/ldraw-parse.types.ts'
