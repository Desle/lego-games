// Starting a clip the animation does not have: the original reads past its clip table.
export class SkeletalAnimationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkeletalAnimationError'
  }
}
