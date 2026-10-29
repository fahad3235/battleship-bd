# Battleship BD

Offline bilingual (English / বাংলা) Battleship game for the browser: place your
5-ship fleet, then sink the computer's fleet before it sinks yours. No account,
no network, no data leaves your device.

## Features

- **Fleet placement** — click to place each ship (Carrier 5, Battleship 4,
  Cruiser 3, Submarine 3, Destroyer 2), horizontal/vertical toggle, one-click
  random placement, clear board.
- **Turn-based battle** — fire at the enemy 10x10 grid; hits, misses and
  sinkings are marked, with a ship-status panel for both fleets.
- **Computer opponent** — hunt-and-target AI: random search, then orthogonal
  neighbours of a hit until the ship sinks.
- **Win / lose detection** — game-over overlay with your shots, hits and
  accuracy, plus Play Again.
- **Career stats** — wins, losses, shots, hits and accuracy persisted in
  `localStorage` (per browser, no account).
- **Bilingual UI** — English / বাংলা toggle, persisted, with Bengali digits
  in Bengali mode. Fully responsive down to 390 px.

## Stack

Vanilla HTML + CSS + JavaScript. Zero dependencies, zero runtime network
requests. Game rules live in `js/logic.js` (shared by the app and the Node
unit tests); strings live in `js/i18n.js`.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Tests

```sh
node tests/test.js          # 16 logic unit tests
node tests/smoke.js         # 15 headless-Chrome smoke checks (desktop)
node tests/smoke.js 390     # 16 headless-Chrome smoke checks (390 px mobile)
```

The smoke test drives headless Chromium over raw CDP (no test framework
dependency). See `TEST_RESULTS.md` for the verified results.

## Rules and limitations

- Ships may touch each other; only overlap and out-of-bounds placements are
  rejected. This is the casual house rule, stated here so it is not mistaken
  for tournament rules.
- The computer AI is a simple hunt-and-target player, not a probability-density
  solver; it plays fairly (no peeking) but is beatable.
- Stats live in `localStorage` only: clearing browser data resets them, and
  they do not sync across devices.
- This is an offline toy game, not a gambling or wagering product.

## Status

MVP complete. See `TEST_RESULTS.md` for the verified test run.
