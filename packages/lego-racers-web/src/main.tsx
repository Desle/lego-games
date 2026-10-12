import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  installFrontEndPixelHarness,
  installPixelTraceHarness,
  postUnsentRecordings,
  RaceView,
} from './modules/track-viewer/index.ts'
import './styles.css'

// The remastered layer exists only in development and only when asked for (`?hd`): a production build has no import.
const loadRemastered = async () => {
  if (!import.meta.env.DEV) return
  const remastered = await import('./modules/remastered/index.ts')
  if (remastered.getIsRemasteredRequested(window.location.search)) {
    remastered.registerRemastered(window.location.search)
  }
}

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('index.html has no #root element')

// The pixel trace's headless browser opens `/?pixel-trace`: the page only hosts the scripted race runner, not the game.
const isPixelTracePage = import.meta.env.DEV && window.location.search === '?pixel-trace'
if (isPixelTracePage) {
  installPixelTraceHarness()
  installFrontEndPixelHarness()
} else {
  void postUnsentRecordings()
  void loadRemastered().then(() =>
    createRoot(rootElement).render(
      <StrictMode>
        <RaceView />
      </StrictMode>
    )
  )
}
