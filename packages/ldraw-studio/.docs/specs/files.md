# Feature: files

## Behaviour

The dev server's side of LDraw for any app (node only, never imported by browser code): one connect-style middleware, `createLDrawFileRoutes({ libraryRoot, modelsRoot, routePrefix })`, that serves the parts library, lists and serves a models folder, lists the library's parts for a builder palette, and saves a model with a timestamped backup of the file it replaces. Every app (the LEGO Racers viewer, the LDraw editor's own page) mounts the same routes.

## User flows

- **Serve the library**: `<prefix>/ldraw/<file>` answers a library file as text (`parts/3001.dat`, `p/stud.dat`, `LDConfig.ldr`); a model may name a part in any case while the library's files are lower case, so the lower-case name is tried second.
- **Browse the models folder**: `<prefix>/ldraw-models/files.json` lists every `.ldr` and `.mpd` under the folder with when it changed; `index.json` gives the model files by folder (`readLDrawModelFolders`), or the shape the app's `getModelIndex` makes of them; any other name serves that model file. Both lists are read at every request, so a new file shows after a reload.
- **Pick parts**: `<prefix>/ldraw-builder/parts.json` lists the library's placeable parts with their descriptions (`readLibraryParts`, read once; moved, alias and sub-parts left out, a renumbered part keeps its old numbers in its description).
- **Save a model**: POST `<prefix>/ldraw-builder/save` with a JSON object holding `text` writes it to the models folder file that `getSavePath` names (by default the request's `path`), after copying the file it replaces to `<backupFolder>/<name>-<time>.<extension>` (`drafts/backups` by default). It answers `{ path, backupPath }` plus whatever the app's `onModelSaved` returns.
- **Add app documents**: `builderJsonFiles` serves more JSON beside the part list (an app's own progress, for instance), read at every request.

## Invariants

- No request reads or writes outside the library or the models folder: an absolute path or a `..` segment is refused on read and on save.
- A save writes only `.ldr` or `.mpd` files holding LDraw lines, and never replaces a file without first copying it into the backup folder.
- Nothing here knows a game: an app's names, folders and index shape come in through the options.

## Out of scope

Reading files in the browser (the `library` and `building` modules fetch from these routes), mounting the middleware (the app's Vite config does), and the routes' URLs in browser code (the app keeps its constants; `getLDrawFileRoutePaths` gives what they must equal).
