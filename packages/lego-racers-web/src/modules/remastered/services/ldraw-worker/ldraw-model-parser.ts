import { setUpModelParser } from '@lego-games/ldraw/geometry'
import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'
import { takeWheelsAndFigures } from '../ldraw-racer-model/racer-model-parts.ts'
import { addLoadMilliseconds, measureWork } from '../performance-monitor/performance-monitor.ts'

// Every page that draws LDraw models calls this first: the dev server's library, the parse worker (a car's body gives up its wheels
// and any minifigure there) and the performance monitor.
export const setUpLDrawModelParser = () =>
  setUpModelParser({
    libraryUrl: DEVELOPMENT_LDRAW_ROUTE,
    createWorker: () =>
      new Worker(new URL('./ldraw-parse.worker.ts', import.meta.url), { type: 'module' }),
    splitSubModels: takeWheelsAndFigures,
    addLoadMilliseconds,
    measureWork,
  })
