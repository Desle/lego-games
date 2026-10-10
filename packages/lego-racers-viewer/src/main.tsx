import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TrackViewerProvider, TrackViewerView } from './modules/track-viewer/index.ts'
import './styles.css'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('index.html has no #root element')

createRoot(rootElement).render(
  <StrictMode>
    <TrackViewerProvider>
      <TrackViewerView />
    </TrackViewerProvider>
  </StrictMode>
)
