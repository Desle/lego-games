import { DEFAULT_KEYBOARD_BINDINGS } from '../default-bindings/default-bindings.ts'
import { getRacerControls } from './get-racer-controls.ts'

describe('default keyboard bindings', () => {
  it('are the first keyboard layout of table 0x004b0624', () => {
    // Arrange / Act
    const codes = DEFAULT_KEYBOARD_BINDINGS.map((binding) => binding.bindingCode)

    // Assert
    expect(codes).toEqual([
      0x100000cb, 0x100000cd, 0x100000c8, 0x100000d0, 0x1000001c, 0x1000009d, 0x10000032,
      0x10000039, 0x100000b8,
    ])
  })
})

describe('getRacerControls', () => {
  it('holds nothing for an idle keyboard and no gamepad', () => {
    // Arrange
    const snapshot = { pressedKeyCodes: new Set<string>(), gamepad: null }

    // Act
    const controls = getRacerControls(snapshot)

    // Assert
    expect(Object.values(controls).filter((value) => value === true)).toHaveLength(0)
    expect(controls.steeringAxis).toBe(0)
  })

  it('maps every default key to its binding', () => {
    // Arrange
    const snapshot = {
      pressedKeyCodes: new Set(DEFAULT_KEYBOARD_BINDINGS.map((binding) => binding.keyCode)),
      gamepad: null,
    }

    // Act
    const controls = getRacerControls(snapshot)

    // Assert
    expect(controls).toMatchObject({
      isSteerPositivePressed: true,
      isSteerNegativePressed: true,
      isAcceleratePressed: true,
      isBrakePressed: true,
      isUsePowerUpPressed: true,
      isChangeCameraPressed: true,
      isChangeHudModePressed: true,
      isPowerSlidePressed: true,
      isLookBehindPressed: true,
    })
  })

  it('maps the left arrow to positive steering and the up arrow to accelerate', () => {
    // Arrange
    const snapshot = { pressedKeyCodes: new Set(['ArrowLeft', 'ArrowUp']), gamepad: null }

    // Act
    const controls = getRacerControls(snapshot)

    // Assert
    expect(controls.isSteerPositivePressed).toBe(true)
    expect(controls.isAcceleratePressed).toBe(true)
    expect(controls.isSteerNegativePressed).toBe(false)
    expect(controls.isBrakePressed).toBe(false)
  })

  it('maps gamepad button n to binding n + 2 and the first axis to the steering axis', () => {
    // Arrange
    const snapshot = {
      pressedKeyCodes: new Set<string>(),
      gamepad: { axes: [-0.5, 0.25], pressedButtonIndices: [0, 5, 9] },
    }

    // Act
    const controls = getRacerControls(snapshot)

    // Assert
    expect(controls.isAcceleratePressed).toBe(true)
    expect(controls.isPowerSlidePressed).toBe(true)
    expect(controls.isBrakePressed).toBe(false)
    expect(controls.steeringAxis).toBe(-0.5)
  })
})
