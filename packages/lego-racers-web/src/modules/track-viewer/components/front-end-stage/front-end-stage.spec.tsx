import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import FrontEndStage from './front-end-stage.tsx'

describe('FrontEndStage', () => {
  it('renders default snapshot', () => {
    // Arrange / Act
    const { container } = render(
      <FrontEndStage canvasReference={createRef()} errorMessage={null} width={800} height={600} />
    )

    // Assert
    expect(container).toMatchSnapshot()
  })

  it('renders the failure message over the stage', () => {
    // Arrange / Act
    const { container } = render(
      <FrontEndStage
        canvasReference={createRef()}
        errorMessage="No MENUDATA"
        width={800}
        height={600}
      />
    )

    // Assert
    expect(container).toMatchSnapshot()
    expect(screen.getByRole('alert')).toHaveTextContent('No MENUDATA')
  })
})
