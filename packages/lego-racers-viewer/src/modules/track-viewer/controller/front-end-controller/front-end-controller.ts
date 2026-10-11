import {
  createFrontEnd,
  getFrontEndFrame,
  getFrontEndRaceRequest,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndEnvironment } from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { useEffect, useRef, useState } from 'react'
import { createFrontEndAudioPlayer } from '../../services/front-end-audio-player/front-end-audio-player.ts'
import { createFrontEndInputSource } from '../../services/front-end-input-source/front-end-input-source.ts'
import { createFrontEndRenderer } from '../front-end-renderer/front-end-renderer.ts'
import type { FrontEndController, FrontEndControllerOptions } from './front-end-controller.types.ts'

// The original never steps a frame by more than 100 ms (Application_ResetFrameClock 0x004162c0).
const MAXIMUM_FRAME_MILLISECONDS = 100
// Progression hook: the circuits are all open until the save files and the circuit progression exist.
const ALL_CIRCUITS_OPEN = 0x7f

// The menus of the game: reads the keyboard and the gamepad, steps the front end, draws its commands on the canvas
// and plays its sounds; a race the menus chose, or the answer yes to the quit question, ends it.
export const useFrontEndController = (options: FrontEndControllerOptions): FrontEndController => {
  const canvasReference = useRef<HTMLCanvasElement | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const callbacksReference = useRef(options)
  callbacksReference.current = options
  const { jam } = options

  useEffect(() => {
    const canvas = canvasReference.current
    if (canvas === null) return undefined
    let animationFrame = 0
    let cleanup = () => undefined
    try {
      const archive = openJamArchive(jam)
      const resources = loadFrontEndResources(archive)
      const renderer = createFrontEndRenderer(canvas, resources)
      const input = createFrontEndInputSource()
      const audio = createFrontEndAudioPlayer(archive)
      const resumeAudio = () => audio.resume()
      window.addEventListener('keydown', resumeAudio)
      const getEnvironment = (): FrontEndEnvironment => ({
        controllerCount: input.getControllerCount(),
        unlockedCircuitMask: ALL_CIRCUITS_OPEN,
        playerRacerNames: [],
        standingRows: callbacksReference.current.standingRows,
      })
      let state = createFrontEnd(
        resources,
        getEnvironment(),
        callbacksReference.current.firstScreenId
      )
      let lastTime: number | null = null
      const onFrame = (time: number) => {
        animationFrame = requestAnimationFrame(onFrame)
        const frameMilliseconds =
          lastTime === null ? 0 : Math.min(MAXIMUM_FRAME_MILLISECONDS, Math.round(time - lastTime))
        lastTime = time
        const environment = getEnvironment()
        const inputs = input.read()
        const steps = inputs.length === 0 ? [null] : inputs
        steps.forEach((step, index) => {
          const result = stepFrontEnd(
            state,
            resources,
            environment,
            step,
            index === 0 ? frameMilliseconds : 0
          )
          state = result.state
          for (const soundName of result.soundNames) audio.playSound(soundName)
        })
        renderer.draw(getFrontEndFrame(state, resources, environment).commands)
        const request = getFrontEndRaceRequest(state)
        if (request !== null) {
          cancelAnimationFrame(animationFrame)
          callbacksReference.current.onRaceRequested(request)
        } else if (state.outcome === 'quit') {
          cancelAnimationFrame(animationFrame)
          callbacksReference.current.onQuit()
        }
      }
      animationFrame = requestAnimationFrame(onFrame)
      cleanup = () => {
        window.removeEventListener('keydown', resumeAudio)
        input.dispose()
        audio.dispose()
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    }
    return () => {
      cancelAnimationFrame(animationFrame)
      cleanup()
    }
  }, [jam])

  return { canvasReference, errorMessage }
}
