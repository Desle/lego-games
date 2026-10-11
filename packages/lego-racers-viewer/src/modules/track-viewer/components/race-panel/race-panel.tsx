import { DEFAULT_KEYBOARD_BINDINGS } from '@lego-games/lego-racers/race-input'
import type { ChangeEvent } from 'react'
import { RaceStatus } from '../../types/race-status/race-status.ts'
import type { RacePanelProps } from './race-panel.types.ts'

// Opens the game's files, stops the race and lists the controls of the menus and the original's default race controls.
const RacePanel = ({
  status,
  errorMessage,
  isDevelopmentFilesAvailable,
  onDevelopmentGameRequested,
  onGameFilesChosen,
  onRaceStopped,
}: RacePanelProps) => {
  const isBusy = status === RaceStatus.LOADING
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    onGameFilesChosen([...(event.target.files ?? [])])
  return (
    <section className="flex flex-col gap-3 text-sm">
      {isDevelopmentFilesAvailable && (
        <button
          type="button"
          className="rounded bg-amber-500 px-3 py-2 font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          disabled={isBusy}
          onClick={onDevelopmentGameRequested}
        >
          Open the game (development files)
        </button>
      )}
      <label className="flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-dashed border-slate-500 p-3 text-center hover:border-amber-400">
        <span className="font-semibold">Choose the game files</span>
        <span className="text-slate-400">
          LEGO.JAM, LEGORacers.exe and the .tun music; they never leave your browser.
        </span>
        <input
          className="sr-only"
          type="file"
          multiple
          disabled={isBusy}
          onChange={onInputChange}
        />
      </label>
      {status === RaceStatus.RUNNING && (
        <button
          type="button"
          className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
          onClick={onRaceStopped}
        >
          Stop the race (back to the menus)
        </button>
      )}
      {status === RaceStatus.MENU && (
        <>
          <p className="text-slate-300">
            Menus: arrow keys or the d-pad move, Enter or button A chooses, Escape or button B goes
            back.
          </p>
          <p className="text-slate-400">
            Car builder: arrows move the brick, R turns it, Enter adds it, U takes the last one off,
            Page Up / Page Down (or Q / E) change the brick, Insert / Delete (or Z / C) the set, A /
            D turn the view, S / X raise and lower it. Escape keeps the car for the next race.
          </p>
        </>
      )}
      {status === RaceStatus.LOADING && <p className="text-slate-300">Loading...</p>}
      {status === RaceStatus.FAILED && (
        <p role="alert" className="text-red-400">
          {errorMessage}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {DEFAULT_KEYBOARD_BINDINGS.map((binding) => (
          <div key={binding.binding} className="contents">
            <dt className="font-mono text-amber-300">{binding.keyLabel}</dt>
            <dd className="text-slate-300">{binding.binding.replaceAll('_', ' ')}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-400">
        A gamepad steers with its first axis; buttons 1 to 7 accelerate, brake, use the power-up,
        change camera, change HUD, power slide and look behind.
      </p>
    </section>
  )
}

export default RacePanel
