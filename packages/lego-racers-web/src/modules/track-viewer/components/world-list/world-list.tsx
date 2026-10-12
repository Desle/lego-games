import type { WorldListProps } from './world-list.types.ts'

// Every world in the archive, grouped by directory.
const WorldList = ({
  worldGroups,
  selectedEntryId,
  isDisabled,
  onWorldEntrySelected,
}: WorldListProps) => (
  <nav className="flex flex-col gap-3 text-sm" aria-label="Worlds">
    {worldGroups.map((group) => (
      <section key={group.directory}>
        <h3 className="mb-1 font-mono text-xs text-slate-400">{group.directory}</h3>
        <ul className="flex flex-col">
          {group.entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                title={entry.worldPaths.join('\n')}
                disabled={isDisabled}
                aria-current={entry.id === selectedEntryId}
                className="w-full rounded px-2 py-0.5 text-left hover:bg-slate-700 disabled:opacity-50 aria-[current=true]:bg-amber-500 aria-[current=true]:text-slate-950"
                onClick={() => onWorldEntrySelected(entry.id)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </nav>
)

export default WorldList
