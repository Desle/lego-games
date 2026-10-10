import { DEVELOPMENT_JAM_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'

// Reads the player's chosen LEGO.JAM in the browser; nothing is uploaded.
export const readJamFile = async (file: Blob): Promise<Uint8Array> =>
  new Uint8Array(await file.arrayBuffer())

// Development only: the dev server hands out the developer's local LEGO.JAM.
export const getDevelopmentJam = async (): Promise<Uint8Array> => {
  const response = await fetch(DEVELOPMENT_JAM_ROUTE)
  if (!response.ok) throw new Error(await response.text())
  return new Uint8Array(await response.arrayBuffer())
}
