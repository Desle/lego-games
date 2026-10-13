// Reads a library file by the name a part line gives it (`s\3001s01.dat`, `stud.dat`); null when there is none.
export type LibraryFileReader = (name: string) => Promise<string | null>

// Reads a file by its path under the library's folder (`parts/s/3001s01.dat`, `p/stud.dat`); null when there is none.
export type LibraryTextReader = (path: string) => Promise<string | null>
