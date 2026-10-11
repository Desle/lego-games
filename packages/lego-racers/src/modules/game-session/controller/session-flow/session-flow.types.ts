export type FinishRaceOptions = {
  // The player left through the pause menu (settings flag 0x08): the runner stops after this race.
  readonly isAborted?: boolean
}
