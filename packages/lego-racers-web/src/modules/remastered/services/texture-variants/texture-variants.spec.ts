import { getTextureVariants } from './texture-variants.ts'

describe('getTextureVariants', () => {
  it('lists the pack folders the dev server reports, and nothing when it has no route', async () => {
    // Arrange
    const responses = [
      new Response(JSON.stringify(['original', 'ultrasharp'])),
      new Response('missing', { status: 404 }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(responses.shift()))
    )

    // Act
    const variants = [await getTextureVariants(), await getTextureVariants()]

    // Assert
    expect(variants).toEqual([['original', 'ultrasharp'], []])
    vi.unstubAllGlobals()
  })
})
