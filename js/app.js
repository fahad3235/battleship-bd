// Battleship BD -- UI wiring. Pure DOM code; game rules live in logic.js.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const L = window.__BATTLESHIP_LOGIC__;
  const I18N = window.__BATTLESHIP_I18N__.I18N;
  const toBnDigits = window.__BATTLESHIP_I18N__.toBnDigits;

  let lang = localStorage.getItem('battleship-lang') || 'en';
  let stats = JSON.parse(localStorage.getItem('battleship-stats') || '{"wins":0,"losses":0,"shots":0,"hits":0}');
  let phase = 'place'; // place | battle | over
  let orientation = 'horizontal';
  let selectedShip = 0; // index into SHIPS
  let player = L.createBoard();
  let enemy = L.randomPlaceAll();
  let ai = L.createAI();
  let playerShots = 0, playerHits = 0;

  function t(key, vars) {
    let s = I18N[lang][key] || I18N.en[key] || key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function shipName(id) { return t('ship_' + id).replace(/ \(\d+\)$/, ''); }

  function buildGrid(el, owner) {
    el.innerHTML = '';
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const b = document.createElement('button');
        b.className = 'cell';
        b.dataset.x = x; b.dataset.y = y;
        b.setAttribute('aria-label', 'cell ' + (x + 1) + ',' + (y + 1));
        b.addEventListener('click', () => onCell(owner, x, y));
        el.appendChild(b);
      }
    }
  }

  function render() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    $('title').textContent = t('title');
    $('tagline').textContent = t('tagline');
    $('yourFleetLabel').textContent = t('yourFleet');
    $('enemyLabel').textContent = t('enemyWaters');
    $('placeTitle').textContent = t('placeTitle');
    $('placeHint').textContent = t('placeHint');
    $('orientBtn').textContent = orientation === 'horizontal' ? t('horizontal') : t('vertical');
    $('randomBtn').textContent = t('random');
    $('clearBtn').textContent = t('clear');
    $('startBtn').textContent = t('startBattle');
    $('newGameBtn').textContent = t('newGame');
    $('langBtn').textContent = t('lang');
    $('statsTitle').textContent = t('stats');
    $('statWinsLabel').textContent = t('wins');
    $('statLossesLabel').textContent = t('losses');
    $('statShotsLabel').textContent = t('shots');
    $('statHitsLabel').textContent = t('hits');
    $('statAccLabel').textContent = t('accuracy');
    $('footer').textContent = t('footer');
    $('statWins').textContent = toBnDigits(stats.wins, lang);
    $('statLosses').textContent = toBnDigits(stats.losses, lang);
    $('statShots').textContent = toBnDigits(stats.shots, lang);
    $('statHits').textContent = toBnDigits(stats.hits, lang);
    const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) + '%' : '-';
    $('statAcc').textContent = toBnDigits(acc, lang);

    // Ship picker
    const picker = $('shipPicker');
    picker.innerHTML = '';
    L.SHIPS.forEach((s, i) => {
      const placed = player.ships.some((sh) => sh.id === s.id);
      const b = document.createElement('button');
      b.className = 'ship-pick' + (i === selectedShip ? ' selected' : '') + (placed ? ' placed' : '');
      b.textContent = t('ship_' + s.id);
      b.disabled = phase !== 'place';
      b.addEventListener('click', () => { selectedShip = i; render(); });
      picker.appendChild(b);
    });

    paintBoard($('playerGrid'), player, true);
    paintBoard($('enemyGrid'), enemy, false);
    renderFleetStatus();

    $('placePanel').style.display = phase === 'place' ? 'block' : 'none';
    $('battleHint').style.display = phase === 'battle' ? 'block' : 'none';
    $('enemyGrid').classList.toggle('active', phase === 'battle');
    $('playerGrid').classList.toggle('dim', phase === 'battle');
    if (phase === 'place') setStatus(t('placeTitle'));
  }

  function paintBoard(el, board, own) {
    const cells = el.querySelectorAll('.cell');
    cells.forEach((c) => {
      const x = +c.dataset.x, y = +c.dataset.y;
      c.className = 'cell';
      const ship = board.ships.find((s) => s.cells.some(([cx, cy]) => cx === x && cy === y));
      if (own && ship) c.classList.add(ship.hits.size === ship.cells.length ? 'sunk' : 'ship');
      if (board.shots.has(x + ',' + y)) {
        c.classList.add(ship ? 'hit' : 'miss');
        c.textContent = ship ? 'X' : 'o';
      } else {
        c.textContent = '';
      }
      c.disabled = phase === 'over' || (own && phase !== 'place') || (!own && phase !== 'battle');
    });
  }

  function renderFleetStatus() {
    const renderOne = (el, board) => {
      el.innerHTML = '';
      L.SHIPS.forEach((s) => {
        const st = L.shipStatus(board, s.id);
        const d = document.createElement('div');
        d.className = 'fleet-row' + (st === 'sunk' ? ' sunk' : '');
        d.textContent = t('ship_' + s.id) + ' | ' + (st === 'sunk' ? t('sunkLabel') : st === 'unplaced' ? '-' : t('afloat'));
        el.appendChild(d);
      });
    };
    renderOne($('playerFleet'), player);
    renderOne($('enemyFleet'), enemy);
  }

  function setStatus(msg) { $('status').textContent = msg; }
  function setError(msg) { $('error').textContent = msg || ''; }

  function onCell(owner, x, y) {
    setError('');
    if (phase === 'place' && owner === 'player') {
      const s = L.SHIPS[selectedShip];
      if (player.ships.some((sh) => sh.id === s.id)) { setError(t('placeAllFirst')); return; }
      const ok = L.placeShip(player, s.id, s.size, x, y, orientation === 'horizontal');
      if (!ok) { setError(t('placeError')); return; }
      const next = L.SHIPS.findIndex((sh) => !player.ships.some((p) => p.id === sh.id));
      if (next >= 0) selectedShip = next;
      render();
    } else if (phase === 'battle' && owner === 'enemy') {
      const r = L.fire(enemy, x, y);
      if (r.result === 'already' || r.result === 'invalid') return;
      playerShots++; stats.shots++;
      if (r.result === 'hit' || r.result === 'sunk') { playerHits++; stats.hits++; }
      if (r.result === 'sunk') setStatus(t('sunk', { ship: shipName(r.shipId) }));
      else if (r.result === 'hit') setStatus(t('hit'));
      else setStatus(t('miss'));
      if (L.allSunk(enemy)) { endGame(true); return; }
      saveStats();
      setStatus(t('enemyTurn'));
      render();
      setTimeout(enemyTurn, 450);
    }
  }

  function enemyTurn() {
    if (phase !== 'battle') return;
    const shot = L.aiNextShot(ai);
    if (!shot) return;
    const [x, y] = shot;
    const r = L.fire(player, x, y);
    L.aiReport(ai, x, y, r.result);
    if (r.result === 'sunk') setStatus(t('sunkYours', { ship: shipName(r.shipId) }));
    else if (r.result === 'hit') setStatus(t('hit'));
    else setStatus(t('miss'));
    if (L.allSunk(player)) { endGame(false); return; }
    setStatus(t('yourTurn'));
    render();
  }

  function endGame(won) {
    phase = 'over';
    if (won) stats.wins++; else stats.losses++;
    saveStats();
    $('overTitle').textContent = won ? t('youWin') : t('youLose');
    $('overDetail').textContent = t('shots') + ': ' + toBnDigits(playerShots, lang) +
      ' | ' + t('hits') + ': ' + toBnDigits(playerHits, lang) +
      ' | ' + t('accuracy') + ': ' + (playerShots ? Math.round(playerHits / playerShots * 100) + '%' : '-');
    $('overDetail').textContent = toBnDigits($('overDetail').textContent, lang);
    $('playAgainBtn').textContent = t('playAgain');
    $('gameOver').style.display = 'block';
    render();
  }

  function saveStats() { localStorage.setItem('battleship-stats', JSON.stringify(stats)); }

  function newGame() {
    phase = 'place';
    player = L.createBoard();
    enemy = L.randomPlaceAll();
    ai = L.createAI();
    playerShots = 0; playerHits = 0;
    selectedShip = 0;
    $('gameOver').style.display = 'none';
    setError('');
    render();
  }

  $('orientBtn').addEventListener('click', () => {
    orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    render();
  });
  $('randomBtn').addEventListener('click', () => {
    player = L.randomPlaceAll() || L.createBoard();
    render();
  });
  $('clearBtn').addEventListener('click', () => {
    player = L.createBoard();
    selectedShip = 0;
    render();
  });
  $('startBtn').addEventListener('click', () => {
    if (player.ships.length < 5) { setError(t('placeAllFirst')); return; }
    phase = 'battle';
    setError('');
    setStatus(t('yourTurn'));
    render();
  });
  $('newGameBtn').addEventListener('click', newGame);
  $('playAgainBtn').addEventListener('click', newGame);
  $('langBtn').addEventListener('click', () => {
    lang = lang === 'en' ? 'bn' : 'en';
    localStorage.setItem('battleship-lang', lang);
    render();
  });

  buildGrid($('playerGrid'), 'player');
  buildGrid($('enemyGrid'), 'enemy');
  render();
})();
