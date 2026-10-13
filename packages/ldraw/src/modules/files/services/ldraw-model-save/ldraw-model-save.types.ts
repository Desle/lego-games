// A model to write into the models folder: its path relative to the folder and its LDraw text.
export type LDrawModelSave = {
  readonly path: string
  readonly text: string
}

// What a save wrote: the model's path and the copy of the file it replaced (null when it made a new file), relative to the folder.
export type LDrawModelSaveResult = {
  readonly path: string
  readonly backupPath: string | null
}
