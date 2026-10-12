export type SoundReplacements = {
  // The replacement for the sound at this archive path once it has loaded, else null (and it starts loading).
  readonly getLoaded: (archivePath: string) => AudioBuffer | null
  // The replacement for the sound at this archive path, or null when no extension has one.
  readonly load: (archivePath: string) => Promise<AudioBuffer | null>
  // Starts loading the replacements, so they are there when the sounds are first played.
  readonly preload: (archivePaths: readonly string[]) => void
}
