import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  installFrontEndPixelHarness,
  installPixelTraceHarness,
  getIsRaceRecordingRequested,
  postUnsentRecordings,
  RaceView,
} from './modules/track-viewer/index.ts'
import './styles.css'

// The remastered layer exists only in development and only when asked for (`?hd`): a production build has no import.
const loadRemastered = async () => {
  if (!import.meta.env.DEV) return
  const remastered = await import('./modules/remastered/index.ts')
  if (remastered.getIsRemasteredRequested(window.location.search)) {
    await remastered.registerRemastered(window.location.search)
  }
}

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('index.html has no #root element')

// The pixel trace's headless browser opens `/?pixel-trace`: the page only hosts the scripted race runner, not the game.
const isPixelTracePage = import.meta.env.DEV && window.location.search === '?pixel-trace'
// The HD coverage trace opens `/?hd&hd-coverage`: the page only hosts the remastered layer's coverage runner.
const isHdCoveragePage =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('hd-coverage')
// The power-up effect sweep opens `/?effect-sweep` (Classic) or `/?hd&effect-sweep`: the page only hosts its scripted race runner.
const isEffectSweepPage =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('effect-sweep')
// The performance trace opens `/?performance-trace` (Classic) or `/?hd&performance-trace`: the page only hosts its scenario runner.
const isPerformanceTracePage =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('performance-trace')
if (isPixelTracePage) {
  installPixelTraceHarness()
  installFrontEndPixelHarness()
} else if (import.meta.env.DEV && isEffectSweepPage) {
  void import('./modules/remastered/index.ts').then((remastered) =>
    remastered.installEffectSweepHarness(window.location.search)
  )
} else if (import.meta.env.DEV && isHdCoveragePage) {
  void import('./modules/remastered/index.ts').then((remastered) =>
    remastered.installHdCoverageHarness(window.location.search)
  )
} else if (import.meta.env.DEV && isPerformanceTracePage) {
  void import('./modules/remastered/index.ts').then((remastered) =>
    remastered.installPerformanceTraceHarness(window.location.search)
  )
} else {
  if (getIsRaceRecordingRequested(window.location.search)) void postUnsentRecordings()
  void loadRemastered().then(() =>
    createRoot(rootElement).render(
      <StrictMode>
        <RaceView />
      </StrictMode>
    )
  )
}
