# Feature: notes

## Behaviour

Reference module: creates short notes with a validated title and stores them. Removed by `pnpm run setup` unless `--keep-example` is passed.

## User flows

- **Create a note**: the caller passes a title; they get back an unpinned note with an id and a creation time.

## Invariants

- A note title is never empty and never longer than 120 characters.
- An invalid note is never saved.

## Out of scope

Persistence beyond memory, editing, deleting and sharing notes.
