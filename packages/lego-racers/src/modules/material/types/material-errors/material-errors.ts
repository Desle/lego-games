// GolDP.dll 0x100282c0: a second material with the same first eight characters is fatal.
export class DuplicateMaterialNameError extends Error {
  readonly materialName: string

  constructor(materialName: string) {
    super(`${materialName}: Duplicate name encountered`)
    this.name = 'DuplicateMaterialNameError'
    this.materialName = materialName
  }
}
