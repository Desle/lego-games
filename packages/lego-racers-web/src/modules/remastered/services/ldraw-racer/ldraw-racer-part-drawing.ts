import { RacerPartKind } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import type {
  RacerPartDrawing,
  RacerPartDrawingRequest,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { createLDrawDriverDrawing } from './ldraw-driver-drawing.ts'
import { createLDrawWheelsDrawing } from './ldraw-wheels-drawing.ts'

// What `?hd` with LDraw bricks draws for a racer's wheels and driver; `search` is the page's query, which says whether the texture
// pack is on (the drivers' faces and chests take their pictures from it).
export const createLDrawRacerPartDrawing = (
  request: RacerPartDrawingRequest,
  search: string
): RacerPartDrawing | null =>
  request.kind === RacerPartKind.WHEELS
    ? createLDrawWheelsDrawing(request)
    : createLDrawDriverDrawing(request, search)
