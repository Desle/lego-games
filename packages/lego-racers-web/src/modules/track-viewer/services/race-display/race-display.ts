import { getViewerExtensions } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import type {
  RaceDisplay,
  WindowMetrics,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'

// The original's race: 800 × 600 (4:3), drawn at one device pixel per pixel and scaled into the window.
export const CLASSIC_RACE_DISPLAY: RaceDisplay = Object.freeze({
  stageSize: Object.freeze({ width: 800, height: 600 }),
  pixelRatio: 1,
  hudDesignSize: Object.freeze({ width: 800, height: 600 }),
  isFullWindow: false,
  getHudCommands: (commands) => commands,
})

// The first registered extension that lays the race out, else the original's.
export const getRaceDisplay = (window: WindowMetrics): RaceDisplay =>
  getViewerExtensions()
    .map((extension) => extension.getRaceDisplay(window))
    .find((display) => display !== null) ?? CLASSIC_RACE_DISPLAY
