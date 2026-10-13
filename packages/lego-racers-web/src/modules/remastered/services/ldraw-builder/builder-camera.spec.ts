import {
  createBuilderView,
  getBuilderGroundAxes,
  getBuilderViewPosition,
  getFramingView,
  orbitBuilderView,
  panBuilderView,
  zoomBuilderView,
} from './builder-camera.ts'

const round = (values: readonly number[]) => values.map((value) => Number(value.toFixed(6)) + 0)

describe('builder camera', () => {
  it('puts the camera back where it was created from', () => {
    // Arrange
    const view = createBuilderView([1, 2, 3], [0, -3, 4], 10)

    // Act
    const position = getBuilderViewPosition(view)

    // Assert
    expect(round(position)).toEqual([1, -4, 11])
  })

  it('orbits about the target at the same distance and keeps above the poles', () => {
    // Arrange
    const view = createBuilderView([0, 0, 0], [1, 0, 0], 5)

    // Act
    const orbited = orbitBuilderView(view, 100, 100000)

    // Assert
    expect(Math.hypot(...getBuilderViewPosition(orbited))).toBeCloseTo(5)
    expect(orbited.elevation).toBeLessThan(Math.PI / 2)
    expect(orbited.azimuth).toBeLessThan(0)
  })

  it('pans in the screen plane and zooms by a pinch', () => {
    // Arrange
    const view = createBuilderView([0, 0, 0], [1, 0, 0], 5)

    // Act
    const panned = panBuilderView(view, 10, 0, 0.1)
    const zoomed = zoomBuilderView(view, -50)

    // Assert
    expect(round(panned.target)).toEqual([0, -1, 0])
    expect(zoomed.distance).toBeLessThan(5)
  })

  it('flattens the camera axes onto the ground', () => {
    // Arrange
    const view = createBuilderView([0, 0, 0], [1, 0, 1], 5)

    // Act
    const axes = getBuilderGroundAxes(view)

    // Assert
    expect(round([...axes.right, ...axes.forward])).toEqual([0, 1, 0, -1, 0, 0])
  })

  it('frames a box about its centre, further back in a narrow viewport, never closer than a small radius', () => {
    // Arrange
    const minimum = [-1, -1, 0] as const
    const maximum = [1, 1, 2] as const

    // Act
    const wide = getFramingView(minimum, maximum, [1, 0, 0], 2, 32)
    const narrow = getFramingView(minimum, maximum, [1, 0, 0], 0.5, 32)
    const tiny = getFramingView([0, 0, 0], [0.01, 0.01, 0.01], [1, 0, 0], 1, 32)

    // Assert
    expect(round(wide.target)).toEqual([0, 0, 1])
    expect(narrow.distance).toBeGreaterThan(wide.distance)
    expect(tiny.distance).toBeGreaterThan(0.5)
  })
})
