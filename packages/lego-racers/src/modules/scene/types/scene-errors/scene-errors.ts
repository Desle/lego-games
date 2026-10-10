// A fatal message GolDP.dll raises while linking a world (0x10017ac0, 0x1002e640, 0x10025f90, 0x10026270).
export class SceneLinkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneLinkError'
  }
}

// GolDP.dll 0x10031c90: "Unable to build pathname, too many characters".
export class ScenePathError extends Error {
  readonly path: string

  constructor(path: string) {
    super('Unable to build pathname, too many characters')
    this.name = 'ScenePathError'
    this.path = path
  }
}
