# Feature: circuit-standings

## Behaviour

The points record of a circuit (`CircuitRunner +4`, constructor `0x00440220`): the points each racer wins per place, the totals over the circuit's four races, the rank used for the final trophy screen, and the rule that drops a lone player who is too far behind.

## User flows

- **Finish a race**: for every racer placed, `awardPlacePoints(standings, racerIndex, place)` (`0x004402c0`, place 0 is first) gives 30, 20, 10, 3, 2 or 1 points.
- **Start a race**: `resetRacePoints` (`0x004402b0`) clears the race's points, `getIsRacerEliminated` (`0x0041edfe`) ends the circuit early, `resetStandings` (`0x00440860`) restarts the circuit.
- **End of the circuit**: `getStandingRank` (`0x00440300`) of the first human racer picks the result screen with `getCircuitResultScreen`.

## Invariants

- Rank counts the racers with strictly more points; ties share the better place.
- The points table has six entries and the record six racers; anything else is refused where the original reads past its arrays.
- Totals wrap at 32 bits like the original's dwords.

## Out of scope

The record's on-screen countdown (`+0x40`, `0x00440330`) and its drawing (`0x00440350`).
