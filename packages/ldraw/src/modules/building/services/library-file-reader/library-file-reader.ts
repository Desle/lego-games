import type { LibraryFileReader, LibraryTextReader } from './library-file-reader.types.ts'

const LIBRARY_FOLDERS: readonly string[] = ['parts', 'p']

// The one reader of library files, wherever the library is (served, on disk): a part line names a file by its place under `parts/`
// or `p/` (`s\3001s01.dat` is `parts/s/3001s01.dat`), in lower case, and each file is read once however many parts place it.
export const createLibraryFileReader = (readText: LibraryTextReader): LibraryFileReader => {
  const texts = new Map<string, Promise<string | null>>()
  const readFromFolders = async (path: string): Promise<string | null> => {
    for (const folder of LIBRARY_FOLDERS) {
      const text = await readText(`${folder}/${path}`)
      if (text !== null) return text
    }
    return null
  }
  return (name) => {
    const path = name.replace(/\\/g, '/').toLowerCase()
    const existing = texts.get(path)
    if (existing !== undefined) return existing
    const text = readFromFolders(path)
    texts.set(path, text)
    return text
  }
}

const fetchText = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url)
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

// The library the app serves at `libraryUrl` (the folder that holds `parts/` and `p/`).
export const createServedLibraryReader = (libraryUrl: string): LibraryFileReader => {
  const base = libraryUrl.replace(/\/$/, '')
  return createLibraryFileReader((path) => fetchText(`${base}/${path}`))
}
