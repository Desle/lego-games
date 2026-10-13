// A model file of the models folder as the file routes' `files.json` lists it: its path in the folder and when it last changed.
export type ModelFile = {
  readonly path: string
  readonly modifiedMilliseconds: number
}

// A file as the model picker offers it: its path and, to show, its name.
export type ModelChoice = {
  readonly path: string
  readonly name: string
}

// The files of one folder, by its path in the models folder (`/` for the folder itself), for the model picker.
export type ModelFolder = {
  readonly folder: string
  readonly files: readonly ModelChoice[]
}

export type ModelTextReader = (path: string) => Promise<string | null>
