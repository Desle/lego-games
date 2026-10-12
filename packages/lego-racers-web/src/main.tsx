import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installPixelTraceHarness, RaceView } from './modules/track-viewer/index.ts'
import './styles.css'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('index.html has no #root element')

// The pixel trace's headless browser opens `/?pixel-trace`: the page only hosts the scripted race runner, not the game.
const isPixelTracePage = import.meta.env.DEV && window.location.search === '?pixel-trace'
if (isPixelTracePage) {
  installPixelTraceHarness()
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <RaceView />
    </StrictMode>
  )
}
