export { parseComputerRacerRoute } from './controller/parse-computer-racer-route/parse-computer-racer-route.ts'
export {
  chooseComputerRacerRoute,
  countComputerRacerRouteVariants,
  getComputerRacerRouteFileName,
  getFallbackComputerRacerRouteFileNames,
} from './controller/choose-computer-racer-route/choose-computer-racer-route.ts'
export {
  ComputerRacerRouteKeyword,
  ComputerRacerRouteLetter,
} from './types/computer-racer-route-keyword/computer-racer-route-keyword.ts'
export type {
  ComputerRacerRoute,
  ComputerRacerRouteChoice,
  ComputerRacerRouteSample,
  ComputerRacerRouteVariantCounts,
  Quaternion,
  Vector3,
} from './types/computer-racer-route.types.ts'
