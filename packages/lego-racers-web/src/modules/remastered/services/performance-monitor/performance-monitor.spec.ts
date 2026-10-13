import type { WebGLRenderer } from 'three'
import type { RaceRenderRequest } from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'
import { createPerformancePass, getIsPerformanceRequested } from './performance-monitor.ts'

const createRequest = (): RaceRenderRequest => {
  const renderer = {
    info: {
      autoReset: true,
      reset: () => undefined,
      render: { calls: 12, triangles: 3400, lines: 560 },
      memory: { geometries: 7, textures: 5 },
      programs: [],
    },
    getContext: () => ({ finish: () => undefined }),
  }
  return { renderer: renderer as unknown as WebGLRenderer } as unknown as RaceRenderRequest
}

describe('getIsPerformanceRequested', () => {
  it('is on with `perf` in the address and off without it', () => {
    // Arrange
    const addresses = ['?hd&perf', '?hd']

    // Act
    const answers = addresses.map(getIsPerformanceRequested)

    // Assert
    expect(answers).toEqual([true, false])
  })
})

describe('createPerformancePass', () => {
  it('runs the pass it wraps before each frame', () => {
    // Arrange
    let frameCount = 0
    const pass = createPerformancePass(createRequest(), {
      beforeRender: () => {
        frameCount += 1
      },
      dispose: () => undefined,
    })

    // Act
    pass.beforeRender()
    pass.beforeRender()
    pass.dispose()

    // Assert
    expect(frameCount).toBe(2)
  })

  it('shows its numbers on the page while it runs and takes them away after', () => {
    // Arrange
    const pass = createPerformancePass(createRequest(), null)

    // Act
    const overlayCount = document.querySelectorAll('pre').length
    pass.dispose()

    // Assert
    expect([overlayCount, document.querySelectorAll('pre').length]).toEqual([1, 0])
  })
})
