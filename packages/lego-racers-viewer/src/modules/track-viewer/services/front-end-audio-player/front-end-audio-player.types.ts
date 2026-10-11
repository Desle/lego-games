export type FrontEndAudioPlayer = {
  readonly resume: () => void
  // Plays MENUDATA\SOUNDS\<name>.PCM.
  readonly playSound: (name: string) => void
  readonly dispose: () => void
}
