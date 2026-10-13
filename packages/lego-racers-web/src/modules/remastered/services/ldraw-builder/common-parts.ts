import type { CommonPartGroup } from './ldraw-builder.types.ts'

// The palette's shortlist, the parts a 1999 car is mostly made of (current library numbers: `3023b`, not the moved `3023`).
export const COMMON_PART_GROUPS: readonly CommonPartGroup[] = Object.freeze([
  {
    label: 'Bricks',
    partNames: ['3005', '3004', '3622', '3010', '3009', '3008', '3003', '3002', '3001', '2456'],
  },
  {
    label: 'Plates',
    partNames: [
      '3024',
      '3023b',
      '3623',
      '3710',
      '3666',
      '3460',
      '3022',
      '3021',
      '3020',
      '3795',
      '3034',
      '3832',
      '3031',
      '3032',
      '3035',
      '2450',
    ],
  },
  { label: 'Tiles', partNames: ['3070b', '3069b', '63864', '2431', '6636', '3068b', '2412b'] },
  {
    label: 'Slopes',
    partNames: [
      '3040b',
      '3039',
      '4286',
      '3298',
      '3044b',
      '3045',
      '3665a',
      '3660a',
      '4287a',
      '30602',
    ],
  },
  {
    label: 'Wedges',
    partNames: ['41769a', '41770a', '43722a', '43723a', '6564', '6565', '41747', '41748', '4859'],
  },
  {
    label: 'Wheels and holders',
    partNames: ['4600', '6157', '4488', '4624', '3641', '6014a', '6015', '30027b', '30028b'],
  },
  {
    label: 'Car parts',
    partNames: [
      '3829c01',
      '30663',
      '2437',
      '3823',
      '6070',
      '4866',
      '4212b',
      '4212a',
      '4070',
      '6141',
    ],
  },
])
