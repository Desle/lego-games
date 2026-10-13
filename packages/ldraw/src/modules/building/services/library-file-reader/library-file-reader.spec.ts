import { createLibraryFileReader } from './library-file-reader.ts'

describe('createLibraryFileReader', () => {
  it('finds a part line name under parts/ or p/, in lower case', async () => {
    // Arrange
    const files: Readonly<Record<string, string>> = {
      'parts/s/3001s01.dat': 'subpart',
      'p/stud.dat': 'stud',
    }
    const read = createLibraryFileReader((path) => Promise.resolve(files[path] ?? null))

    // Act
    const texts = await Promise.all([read('S\\3001s01.dat'), read('stud.dat'), read('none.dat')])

    // Assert
    expect(texts).toEqual(['subpart', 'stud', null])
  })

  it('reads each file once', async () => {
    // Arrange
    const readText = vi.fn((path: string) => Promise.resolve(path === 'parts/3001.dat' ? '' : null))
    const read = createLibraryFileReader(readText)

    // Act
    await Promise.all([read('3001.dat'), read('3001.DAT')])

    // Assert
    expect(readText.mock.calls).toEqual([['parts/3001.dat']])
  })
})
