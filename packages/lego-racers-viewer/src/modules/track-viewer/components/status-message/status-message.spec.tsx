import { render } from '@testing-library/react'
import { ViewerStatus } from '../../types/viewer-status/viewer-status.ts'
import StatusMessage from './status-message.tsx'

describe('StatusMessage', () => {
  it('renders default snapshot', () => {
    // Arrange
    const status = ViewerStatus.WAITING_FOR_ARCHIVE

    // Act
    const { container } = render(<StatusMessage status={status} errorMessage={null} />)

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders every status', () => {
    // Arrange
    const statuses = Object.values(ViewerStatus)

    // Act
    const { container } = render(
      <>
        {statuses.map((status) => (
          <StatusMessage key={status} status={status} errorMessage="Illegal mesh reference" />
        ))}
      </>
    )

    // Assert
    expect(container).toMatchSnapshot()
  })
})
