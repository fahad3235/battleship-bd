// Node unit tests for battleship-bd logic. Run: node tests/test.js
'use strict';
const assert = require('assert');
const L = require('../js/logic');

let n = 0;
function check(name, fn) { n++; fn(); console.log('ok ' + n + ' - ' + name); }

// Deterministic RNG (mulberry32)
function rngSeed(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

check('horizontal placement in bounds', () => {
  const b = L.createBoard();
  assert.strictEqual(L.placeShip(b, 'destroyer', 2, 0, 0, true), true);
  assert.strictEqual(b.ships[0].cells.length, 2);
});
check('vertical placement grows downward', () => {
  const b = L.createBoard();
  assert.strictEqual(L.placeShip(b, 'cruiser', 3, 5, 5, false), true);
  assert.deepStrictEqual(b.ships[0].cells, [[5, 5], [5, 6], [5, 7]]);
});
check('out-of-bounds rejected (right edge)', () => {
  const b = L.createBoard();
  assert.strictEqual(L.placeShip(b, 'carrier', 5, 6, 0, true), false);
  assert.strictEqual(b.ships.length, 0);
});
check('out-of-bounds rejected (bottom edge)', () => {
  const b = L.createBoard();
  assert.strictEqual(L.placeShip(b, 'battleship', 4, 0, 7, false), false);
});
check('overlap rejected', () => {
  const b = L.createBoard();
  L.placeShip(b, 'destroyer', 2, 0, 0, true);
  assert.strictEqual(L.placeShip(b, 'submarine', 3, 1, 0, true), false);
});
check('exact edge fit allowed (x=5, size 5)', () => {
  const b = L.createBoard();
  assert.strictEqual(L.placeShip(b, 'carrier', 5, 5, 9, true), true);
});
check('fire miss, repeat = already, out of bounds = invalid', () => {
  const b = L.createBoard();
  L.placeShip(b, 'destroyer', 2, 0, 0, true);
  assert.strictEqual(L.fire(b, 5, 5).result, 'miss');
  assert.strictEqual(L.fire(b, 5, 5).result, 'already');
  assert.strictEqual(L.fire(b, 10, 0).result, 'invalid');
});
check('hit then sunk, allSunk only when fleet gone', () => {
  const b = L.createBoard();
  L.placeShip(b, 'destroyer', 2, 0, 0, true);
  L.placeShip(b, 'submarine', 3, 3, 3, true);
  assert.strictEqual(L.fire(b, 0, 0).result, 'hit');
  assert.strictEqual(L.allSunk(b), false);
  const r = L.fire(b, 1, 0);
  assert.strictEqual(r.result, 'sunk');
  assert.strictEqual(r.shipId, 'destroyer');
  assert.strictEqual(L.allSunk(b), false);
  L.fire(b, 3, 3); L.fire(b, 4, 3); L.fire(b, 5, 3);
  assert.strictEqual(L.allSunk(b), true);
});
check('shipStatus: unplaced / afloat / sunk', () => {
  const b = L.createBoard();
  assert.strictEqual(L.shipStatus(b, 'carrier'), 'unplaced');
  L.placeShip(b, 'destroyer', 2, 0, 0, true);
  assert.strictEqual(L.shipStatus(b, 'destroyer'), 'afloat');
  L.fire(b, 0, 0); L.fire(b, 1, 0);
  assert.strictEqual(L.shipStatus(b, 'destroyer'), 'sunk');
});
check('randomPlaceAll places all 5 ships, 17 cells, no overlap (seeded)', () => {
  const b = L.randomPlaceAll(rngSeed(42));
  assert.ok(b);
  assert.strictEqual(b.ships.length, 5);
  const cells = new Set();
  b.ships.forEach((s) => s.cells.forEach(([x, y]) => cells.add(x + ',' + y)));
  assert.strictEqual(cells.size, 17);
});
check('randomPlaceAll reproducible with same seed', () => {
  const a = L.randomPlaceAll(rngSeed(7));
  const c = L.randomPlaceAll(rngSeed(7));
  assert.deepStrictEqual(
    a.ships.map((s) => s.cells),
    c.ships.map((s) => s.cells));
});
check('AI hunt never repeats a cell (100 shots, seeded)', () => {
  const ai = L.createAI();
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const s = L.aiNextShot(ai, rngSeed(100 + i));
    assert.ok(s, 'shot returned');
    const k = s[0] + ',' + s[1];
    assert.ok(!seen.has(k), 'no repeat: ' + k);
    seen.add(k);
  }
});
check('AI target mode queues orthogonal neighbours after a hit', () => {
  const ai = L.createAI();
  L.aiReport(ai, 5, 5, 'hit');
  const shots = new Set();
  for (let i = 0; i < 4; i++) shots.add(L.aiNextShot(ai, rngSeed(1)).join(','));
  const expected = ['6,5', '4,5', '5,6', '5,4'];
  expected.forEach((e) => assert.ok(shots.has(e), 'expected neighbour ' + e));
});
check('AI target queue cleared on sunk', () => {
  const ai = L.createAI();
  L.aiReport(ai, 5, 5, 'hit');
  L.aiReport(ai, 6, 5, 'sunk');
  assert.strictEqual(ai.targets.length, 0);
});
check('AI target skips already-tried neighbours', () => {
  const ai = L.createAI();
  ai.tried.add('6,5');
  L.aiReport(ai, 5, 5, 'hit');
  const s = L.aiNextShot(ai, rngSeed(1));
  assert.notStrictEqual(s.join(','), '6,5');
});
check('full game: 17 hits sink a random fleet exactly', () => {
  const b = L.randomPlaceAll(rngSeed(99));
  let hits = 0;
  b.ships.forEach((s) => s.cells.forEach(([x, y]) => {
    const r = L.fire(b, x, y);
    if (r.result === 'hit' || r.result === 'sunk') hits++;
  }));
  assert.strictEqual(hits, 17);
  assert.strictEqual(L.allSunk(b), true);
});

console.log('\n' + n + '/' + n + ' unit tests passed');
