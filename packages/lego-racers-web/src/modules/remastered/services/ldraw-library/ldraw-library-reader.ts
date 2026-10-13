import { createServedLibraryReader } from '@lego-games/ldraw/building'
import { DEVELOPMENT_LDRAW_ROUTE } from './ldraw-library-route.ts'

// The dev server's library files as text, each read once for the page (part shapes, studs, a recipe's faces).
export const readDevelopmentLibraryFile = createServedLibraryReader(DEVELOPMENT_LDRAW_ROUTE)
