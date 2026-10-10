import type { ChangeEvent, DragEvent } from 'react'
import type { JamFilePickerProps } from './jam-file-picker.types.ts'

const getFirstFile = (files: FileList | null): File | null => files?.[0] ?? null

// Lets the player pick or drop their own LEGO.JAM; the file is read in the browser only.
const JamFilePicker = ({
  isBusy,
  isDevelopmentJamAvailable,
  onJamFileChosen,
  onDevelopmentJamRequested,
}: JamFilePickerProps) => {
  const chooseFile = (file: File | null) => {
    if (file !== null) onJamFileChosen(file)
  }
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    chooseFile(getFirstFile(event.target.files))
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    chooseFile(getFirstFile(event.dataTransfer.files))
  }
  const onDragOver = (event: DragEvent<HTMLLabelElement>) => event.preventDefault()
  return (
    <div className="flex flex-col gap-2">
      <label
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-500 p-4 text-center text-sm hover:border-amber-400"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <span className="font-semibold">Open LEGO.JAM</span>
        <span className="text-slate-400">Pick or drop the file; it never leaves your browser.</span>
        <input
          className="sr-only"
          type="file"
          accept=".jam,.JAM"
          disabled={isBusy}
          onChange={onInputChange}
        />
      </label>
      {isDevelopmentJamAvailable && (
        <button
          type="button"
          className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600 disabled:opacity-50"
          disabled={isBusy}
          onClick={onDevelopmentJamRequested}
        >
          Load the development LEGO.JAM
        </button>
      )}
    </div>
  )
}

export default JamFilePicker
