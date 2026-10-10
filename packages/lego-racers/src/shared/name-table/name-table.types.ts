export type NameTable = {
  // Throws DuplicateNameError when the key is already present.
  readonly add: (name: string, index: number) => void
  readonly find: (name: string) => number | null
}
