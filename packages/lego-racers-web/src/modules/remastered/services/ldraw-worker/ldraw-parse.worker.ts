import { listenForParseRequests } from '@lego-games/ldraw/geometry'
import { takeWheelsAndFigures } from '../ldraw-racer-model/racer-model-parts.ts'

// The LDraw parser's worker: a car's body gives up its wheels and any minifigure here, before it is merged.
listenForParseRequests(takeWheelsAndFigures)
