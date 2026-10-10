import { fireEvent, render } from '@testing-library/react'
import JamFilePicker from './jam-file-picker.tsx'

const renderPicker = (isBusy: boolean, isDevelopmentJamAvailable: boolean) => {
  const onJamFileChosen = vi.fn()
  const onDevelopmentJamRequested = vi.fn()
  const result = render(
    <JamFilePicker
      isBusy={isBusy}
      isDevelopmentJamAvailable={isDevelopmentJamAvailable}
      onJamFileChosen={onJamFileChosen}
      onDevelopmentJamRequested={onDevelopmentJamRequested}
    />
  )
  return { ...result, onJamFileChosen, onDevelopmentJamRequested }
}

describe('JamFilePicker', () => {
  it('renders default snapshot', () => {
    // Arrange
    const isBusy = false

    // Act
    const { container } = renderPicker(isBusy, false)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the development button and the busy state', () => {
    // Arrange
    const isBusy = true

    // Act
    const { container } = renderPicker(isBusy, true)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('hands a picked file and the development request to its handlers', () => {
    // Arrange
    const { container, getByRole, onJamFileChosen, onDevelopmentJamRequested } = renderPicker(
      false,
      true
    )
    const file = new File(['LJAM'], 'LEGO.JAM')
    const input = container.querySelector('input')!

    // Act
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(getByRole('button'))

    // Assert
    expect(onJamFileChosen).toHaveBeenCalledWith(file)
    expect(onDevelopmentJamRequested).toHaveBeenCalledOnce()
  })
})
