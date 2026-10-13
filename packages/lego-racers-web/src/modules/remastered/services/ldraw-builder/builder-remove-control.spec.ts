import { createBuilderRemoveControl } from './builder-remove-control.ts'

const POWER_UP_FILE = 'powerups/BARREL.ldr'

const click = (element: HTMLElement, className: string) =>
  element.querySelector<HTMLButtonElement>(`.${className}`)?.click()

describe('createBuilderRemoveControl', () => {
  it('shows the button only while the item has a file', () => {
    // Arrange
    const control = createBuilderRemoveControl(vi.fn())
    const isHiddenAtStart = control.element.hidden

    // Act
    control.show({ isShown: true, file: POWER_UP_FILE })
    const isHiddenWithFile = control.element.hidden
    control.show({ isShown: false, file: POWER_UP_FILE })

    // Assert
    expect(isHiddenAtStart).toBe(true)
    expect(isHiddenWithFile).toBe(false)
    expect(control.element.hidden).toBe(true)
  })

  it('asks in the bar before it removes, and a cancel removes nothing', () => {
    // Arrange
    const onRemove = vi.fn()
    const control = createBuilderRemoveControl(onRemove)
    control.show({ isShown: true, file: POWER_UP_FILE })
    const question = control.element.querySelector<HTMLElement>('.remove-question')

    // Act
    click(control.element, 'remove')
    const isAsking = question?.hidden === false
    click(control.element, 'remove-cancel')
    const removesAfterCancel = onRemove.mock.calls.length
    click(control.element, 'remove')
    click(control.element, 'remove-confirm')

    // Assert
    expect(isAsking).toBe(true)
    expect(question?.textContent).toContain(`Remove ${POWER_UP_FILE}?`)
    expect(removesAfterCancel).toBe(0)
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(question?.hidden).toBe(true)
  })

  it('renders the shown and the asked states', () => {
    // Arrange
    const control = createBuilderRemoveControl(vi.fn())
    control.show({ isShown: true, file: POWER_UP_FILE })
    const shown = control.element.outerHTML

    // Act
    click(control.element, 'remove')

    // Assert
    expect(shown).toMatchSnapshot()
    expect(control.element.outerHTML).toMatchSnapshot()
  })
})
