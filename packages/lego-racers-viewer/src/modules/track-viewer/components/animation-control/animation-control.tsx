import type { AnimationControlProps } from './animation-control.types.ts'

// Plays or pauses the skeleton animations and the sky, and says what there is to animate.
const AnimationControl = ({
  isPlaying,
  animatedInstanceCount,
  isSkyShown,
  onPlayingToggled,
}: AnimationControlProps) => (
  <section className="flex items-center gap-3 text-xs">
    <button
      type="button"
      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
      aria-pressed={!isPlaying}
      onClick={onPlayingToggled}
    >
      {isPlaying ? 'Pause animation' : 'Play animation'}
    </button>
    <span className="text-slate-400">
      {animatedInstanceCount} animated {animatedInstanceCount === 1 ? 'instance' : 'instances'}
      {isSkyShown && ' · sky'}
    </span>
  </section>
)

export default AnimationControl
