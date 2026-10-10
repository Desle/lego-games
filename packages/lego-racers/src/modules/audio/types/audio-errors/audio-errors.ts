export class SoundEffectReadError extends Error {
  constructor(reason: string) {
    super(`Error reading sound effect: ${reason}`)
    this.name = 'SoundEffectReadError'
  }
}

export class MusicReadError extends Error {
  constructor(reason: string) {
    super(`Error reading music: ${reason}`)
    this.name = 'MusicReadError'
  }
}
