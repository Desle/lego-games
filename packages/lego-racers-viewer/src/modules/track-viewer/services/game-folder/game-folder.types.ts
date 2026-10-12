export type GameFolderFileHandle = {
  readonly kind: 'file'
  readonly name: string
  readonly getFile: () => Promise<File>
}

export type GameFolderDirectoryHandle = {
  readonly kind: 'directory'
  readonly name: string
  readonly values: () => AsyncIterable<GameFolderEntryHandle>
}

export type GameFolderEntryHandle = GameFolderFileHandle | GameFolderDirectoryHandle

export type DirectoryPickerWindow = {
  readonly showDirectoryPicker?: () => Promise<GameFolderDirectoryHandle>
}
