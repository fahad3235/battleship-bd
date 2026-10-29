# TEST RESULTS — battleship-bd (run #175, 14:00 slot, 2026-10-29)

## Unit tests (Node, real run)

`node tests/test.js` — **16/16 passed**, including hand-verified cases:

- Horizontal placement grows right, vertical grows down (exact cell lists asserted).
- Out-of-bounds rejected at the right edge (x=6, size 5) and bottom edge (y=7, size 4);
  exact edge fit allowed (x=5, size 5).
- Overlap rejected; fire miss / repeat = `already` / out-of-bounds = `invalid`.
- Hit then sunk with correct `shipId`; `allSunk` true only after all 17 cells hit.
- `shipStatus`: unplaced / afloat / sunk transitions.
- Seeded `randomPlaceAll`: all 5 ships, exactly 17 distinct cells, reproducible
  with the same seed.
- AI: 100 hunt shots with no repeat; target mode queues exactly the 4 orthogonal
  neighbours of a hit; queue cleared on sunk; already-tried neighbours skipped.
- Full game: 17 hits on a seeded fleet sink it exactly.

## Headless-Chrome smoke (raw CDP, real run)

- Desktop: **15/15 passed**, 0 console/page errors.
- Mobile 390 px: **16/16 passed** (extra: no horizontal overflow), 0 console/page errors.

Verified end to end in the browser: 200 cells render, 5 ship picker buttons,
random placement marks all 5 ships placed and paints exactly 17 ship cells,
Start battle activates the enemy grid with "Your turn" status, a fired enemy
cell resolves to hit/miss, the computer's return fire marks the player board
within ~2 s, status returns to "Your turn", Bengali toggle renders a Bengali
title and persists `battleship-lang = bn`, career shots persist in localStorage.

## Repairs

- 1 test-side fix only: the career-shots smoke check read the rendered stat text,
  which is a Bengali digit after the BN toggle (`Number("১")` is NaN). The check
  now reads the persisted stats JSON. 0 app-logic bugs found.

## Source hygiene

All sources pure ASCII: Bengali strings in `js/i18n.js` are `\uXXXX` escapes
(verified with `grep -P '[^\x00-\x7F]'` — zero matches across js/, index.html,
css/). Zero runtime network requests by design (static files only).
