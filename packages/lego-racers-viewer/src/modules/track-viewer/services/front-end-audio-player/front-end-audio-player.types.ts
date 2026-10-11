export type FrontEndAudioPlayer = {
  readonly resume: () => void
  // Plays MENUDATA\SOUNDS\<name>.PCM.
  readonly playSound: (name: string) => void
  // Starts entry `listIndex` of MENUDATA\LEGOMSC, looped, in place of the tune playing (null: none).
  readonly playMusic: (listIndex: number | null) => void
  readonly dispose: () => void
}
