// Battleship BD -- pure game logic (no DOM). Shared by the app and the node tests.
'use strict';
const SIZE = 10;
const SHIPS = [
  { id: 'carrier', size: 5 },
  { id: 'battleship', size: 4 },
  { id: 'cruiser', size: 3 },
  { id: 'submarine', size: 3 },
  { id: 'destroyer', size: 2 },
];

function createBoard() {
  return { ships: [], shots: new Set() }; // shots: "x,y" keys
}
function key(x, y) { return x + ',' + y; }
function inBounds(x, y) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }
function shipCells(size, x, y, horizontal) {
  const cells = [];
  for (let i = 0; i < size; i++) cells.push(horizontal ? [x + i, y] : [x, y + i]);
  return cells;
}
function canPlace(board, size, x, y, horizontal) {
  const cells = shipCells(size, x, y, horizontal);
  if (!cells.every(([cx, cy]) => inBounds(cx, cy))) return false;
  const occupied = new Set();
  board.ships.forEach((s) => s.cells.forEach(([cx, cy]) => occupied.add(key(cx, cy))));
  return cells.every(([cx, cy]) => !occupied.has(key(cx, cy)));
}
function placeShip(board, id, size, x, y, horizontal) {
  if (!canPlace(board, size, x, y, horizontal)) return false;
  board.ships.push({ id, size, cells: shipCells(size, x, y, horizontal), hits: new Set() });
  return true;
}
function randomPlaceAll(rng) {
  const board = createBoard();
  const rand = rng || Math.random;
  for (const s of SHIPS) {
    let placed = false;
    for (let tries = 0; tries < 1000 && !placed; tries++) {
      const horizontal = rand() < 0.5;
      const x = Math.floor(rand() * SIZE);
      const y = Math.floor(rand() * SIZE);
      placed = placeShip(board, s.id, s.size, x, y, horizontal);
    }
    if (!placed) return null;
  }
  return board;
}
// Returns: { result: 'invalid'|'already'|'miss'|'hit'|'sunk', shipId? }
function fire(board, x, y) {
  if (!inBounds(x, y)) return { result: 'invalid' };
  const k = key(x, y);
  if (board.shots.has(k)) return { result: 'already' };
  board.shots.add(k);
  for (const s of board.ships) {
    if (s.cells.some(([cx, cy]) => cx === x && cy === y)) {
      s.hits.add(k);
      return { result: s.hits.size === s.cells.length ? 'sunk' : 'hit', shipId: s.id };
    }
  }
  return { result: 'miss' };
}
function allSunk(board) {
  return board.ships.length > 0 && board.ships.every((s) => s.hits.size === s.cells.length);
}
function shipStatus(board, id) {
  const s = board.ships.find((sh) => sh.id === id);
  if (!s) return 'unplaced';
  return s.hits.size === s.cells.length ? 'sunk' : 'afloat';
}

// Computer AI: hunt (random untried cell) + target (orthogonal neighbours of hits).
function createAI() {
  return { targets: [], tried: new Set() };
}
function aiNextShot(ai, rng) {
  const rand = rng || Math.random;
  while (ai.targets.length) {
    const [x, y] = ai.targets.shift();
    if (inBounds(x, y) && !ai.tried.has(key(x, y))) {
      ai.tried.add(key(x, y));
      return [x, y];
    }
  }
  for (let tries = 0; tries < 10000; tries++) {
    const x = Math.floor(rand() * SIZE);
    const y = Math.floor(rand() * SIZE);
    if (!ai.tried.has(key(x, y))) {
      ai.tried.add(key(x, y));
      return [x, y];
    }
  }
  return null;
}
function aiReport(ai, x, y, result) {
  if (result === 'hit') {
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny) && !ai.tried.has(key(nx, ny))) ai.targets.push([nx, ny]);
    });
  } else if (result === 'sunk') {
    ai.targets = [];
  }
}

const EXPORTS = { SIZE, SHIPS, createBoard, key, inBounds, canPlace, placeShip,
  randomPlaceAll, fire, allSunk, shipStatus, createAI, aiNextShot, aiReport };
if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
if (typeof window !== 'undefined') window.__BATTLESHIP_LOGIC__ = EXPORTS;
