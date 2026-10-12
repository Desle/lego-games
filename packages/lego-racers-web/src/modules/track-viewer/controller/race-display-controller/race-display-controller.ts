import { useEffect, useState } from 'react'
import type { RaceDisplay } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { getRaceDisplay } from '../../services/race-display/race-display.ts'

const getDisplay = (): RaceDisplay =>
  getRaceDisplay({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  })

// How the race is laid out now; it follows the window's size when an extension lays the race out.
export const useRaceDisplayController = (): RaceDisplay => {
  const [display, setDisplay] = useState(getDisplay)
  useEffect(() => {
    const onResize = () => setDisplay(getDisplay())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return display
}
