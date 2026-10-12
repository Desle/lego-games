import { INITIAL_ENGINE_SOUND_STATE, stepEngineSounds } from './engine-sounds.ts'
import type { EngineSoundInput, EngineSoundState } from './engine-sounds.types.ts'

const DRIVING: EngineSoundInput = {
  isRunning: true,
  isQuiet: false,
  isDriverThrottling: false,
  throttle: 444.96,
  speed: 0.0569306,
  forwardSpeed: 0.0568746,
  airborneMilliseconds: 0,
  engineSoundValue: 0.97,
}

describe('stepEngineSounds', () => {
  it('moves the fades by 0.0594 a 33 ms step as the emulator does (frames 168 and 169 of the first race)', () => {
    // Arrange
    const state: EngineSoundState = {
      mode: 1,
      fades: [0.4623997, 0.2376002, 0],
      isPlaying: [true, true, false],
      isSkidPlaying: false,
    }

    // Act
    const step = stepEngineSounds(state, DRIVING, 33)

    // Assert
    expect(step.state.fades[0]).toBeCloseTo(0.403, 4)
    expect(step.state.fades[1]).toBeCloseTo(0.297, 4)
    expect(step.state.fades[2]).toBe(0)
  })

  it('stops a loop that has faded out and holds the middle loop at 0.7', () => {
    // Arrange
    const state: EngineSoundState = {
      mode: 1,
      fades: [0.0466, 0.6534, 0],
      isPlaying: [true, true, false],
      isSkidPlaying: false,
    }

    // Act
    const step = stepEngineSounds(stepEngineSounds(state, DRIVING, 33).state, DRIVING, 33)

    // Assert
    expect(step.state.fades[0]).toBe(0)
    expect(step.state.isPlaying[0]).toBe(false)
    expect(step.state.fades[1]).toBeCloseTo(0.7, 6)
  })

  it('does nothing before the racer flag 0x400 is set', () => {
    // Arrange / Act
    const step = stepEngineSounds(INITIAL_ENGINE_SOUND_STATE, { ...DRIVING, isRunning: false }, 33)

    // Assert
    expect(step.loops).toEqual([])
    expect(step.state).toBe(INITIAL_ENGINE_SOUND_STATE)
  })

  it('starts the skid with sound 2 when a braking racer still moves, and ends it when it stops', () => {
    // Arrange
    const braking = { ...DRIVING, throttle: -10, forwardSpeed: 0.05 }

    // Act
    const started = stepEngineSounds(INITIAL_ENGINE_SOUND_STATE, braking, 33)
    const stopped = stepEngineSounds(started.state, { ...braking, forwardSpeed: 0.005 }, 33)

    // Assert
    expect(started.isSkidStarted).toBe(true)
    expect(started.state.isSkidPlaying).toBe(true)
    expect(stopped.isSkidStarted).toBe(false)
    expect(stopped.state.isSkidPlaying).toBe(false)
  })
})
