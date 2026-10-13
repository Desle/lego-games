import { createHeldCache } from './held-cache.ts'

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('createHeldCache', () => {
  it('makes a value once for every holder of its key', async () => {
    // Arrange
    const cache = createHeldCache<string>(() => undefined, 1)
    const create = vi.fn(() => Promise.resolve('model'))

    // Act
    const first = cache.hold('key', create)
    const second = cache.hold('key', create)

    // Assert
    expect([create.mock.calls.length, await first.value, await second.value]).toEqual([
      1,
      'model',
      'model',
    ])
  })

  it('keeps idle values up to the limit and frees the oldest beyond it', async () => {
    // Arrange
    const freed: string[] = []
    const cache = createHeldCache<string>((value) => freed.push(value), 1)
    const first = cache.hold('first', () => Promise.resolve('first'))
    const second = cache.hold('second', () => Promise.resolve('second'))

    // Act
    first.release()
    second.release()
    await flushPromises()

    // Assert
    expect([freed, cache.getSize()]).toEqual([['first'], 1])
  })

  it('frees nothing while a value has a holder left', async () => {
    // Arrange
    const freed: string[] = []
    const cache = createHeldCache<string>((value) => freed.push(value), 0)
    const first = cache.hold('key', () => Promise.resolve('model'))
    cache.hold('key', () => Promise.resolve('model'))

    // Act
    first.release()
    first.release()
    await flushPromises()

    // Assert
    expect([freed, cache.getSize()]).toEqual([[], 1])
  })

  it('makes a failed value again when it is asked for again', async () => {
    // Arrange
    const cache = createHeldCache<string>(() => undefined, 1)
    await cache.hold('key', () => Promise.reject(new Error('no library'))).value.catch(() => null)

    // Act
    const retried = await cache.hold('key', () => Promise.resolve('model')).value

    // Assert
    expect(retried).toBe('model')
  })
})
