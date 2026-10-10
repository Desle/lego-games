// GolDP.dll 0x100282c0: adding a name the table already holds (first eight characters) is fatal.
export class DuplicateNameError extends Error {
  readonly duplicateName: string

  constructor(duplicateName: string) {
    super(`${duplicateName}: Duplicate name encountered`)
    this.name = 'DuplicateNameError'
    this.duplicateName = duplicateName
  }
}

// Input the original cannot survive (endless loop, stack overwrite); the port refuses it.
export class UnportableFileError extends Error {
  readonly position: number

  constructor(reason: string, position: number) {
    super(`${reason} (at byte ${String(position)})`)
    this.name = 'UnportableFileError'
    this.position = position
  }
}
