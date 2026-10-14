import type { KnownEffectSweepGap } from './power-up-effect-sweep.types.ts'

// The failures the power-up effect sweep finds on main today, each with what is wrong and what fixes it. A failure that matches an
// entry does not fail the sweep; an entry the sweep no longer finds does (remove it), so the list only shrinks. Never add an entry
// to make a new failure pass: fix the effect. Keys are the original's picture hashes (Classic) or `<kind> <name>` (the layer).
export const KNOWN_EFFECT_SWEEP_GAPS: readonly KnownEffectSweepGap[] = [
  {
    caseName: 'yellow 2 magnet',
    mode: 'classic',
    check: 'texture',
    key: 'e71517cf2200b212',
    reason:
      "The magnet's beam below the dish (`magdust4`; the instances insd and magring, LEGORacers.exe 0x0045adf0, 0x00455ef0) was never ported: every pixel of it differs",
  },
  {
    caseName: 'yellow 1 barrel',
    mode: 'classic',
    check: 'texture',
    key: 'a2adcf36e3ca14e5',
    reason:
      'Open, not examined: the barrel (`barrel3`) right after its launch (frame 307, in front of the camera) differs in 64 % of its pixels',
  },
  {
    caseName: 'red 3 rockets',
    mode: 'classic',
    check: 'texture',
    key: '0592d341977b17fa',
    reason:
      "Open, not examined: a rocket's afterburner (`aftrburn`) at frame 345 differs in 72 % of its pixels",
  },
  {
    caseName: 'red 0 cannon',
    mode: 'hd_empty',
    check: 'hidden',
    key: 'particle canstrk',
    reason:
      "Open: under ?hd the cannon's trail (`canstrk`, the original's quads, no file) changes 974 pixels at frame 310 where Classic changes 7,015",
  },
  {
    caseName: 'red 0 cannon',
    mode: 'hd_files',
    check: 'hidden',
    key: 'particle canstrk',
    reason:
      "Open: under ?hd the cannon's trail (`canstrk`, the original's quads) changes 1,433 pixels at frame 310 where Classic changes 7,015",
  },
]
