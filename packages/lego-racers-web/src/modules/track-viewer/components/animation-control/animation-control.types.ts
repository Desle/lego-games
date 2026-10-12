export type AnimationControlProps = {
  readonly isPlaying: boolean
  // Skeleton instances with a mesh: the props and characters the animation moves.
  readonly animatedInstanceCount: number
  // Whether the race draws a sky; it runs with the animation.
  readonly isSkyShown: boolean
  readonly onPlayingToggled: () => void
}
