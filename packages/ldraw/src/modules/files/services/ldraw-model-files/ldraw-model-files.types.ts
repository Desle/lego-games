// A model file under the models folder: its path relative to the folder and when it last changed on disk.
export type LDrawModelFile = {
  readonly path: string
  readonly modifiedMilliseconds: number
}

// The model files of each folder under the models folder, by the folder's relative path (`''` for the folder itself), by file name.
export type LDrawModelFolders = Readonly<Record<string, readonly string[]>>
