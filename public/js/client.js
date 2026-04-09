'use strict';

// ── UNO Client ──────────────────────────────────────────────────────
const socket = io();

// ── State ───────────────────────────────────────────────────────────
let myId = null;
let isHost = false;
let gameState = null;
let pendingWildCard = null; // card waiting for color choice
let currentVariant = 'classic';
let hasDrawnThisTurn = false; // true if we drew and can play the drawn card

// ── DOM refs ────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const joinScreen = $('#join-screen');
const lobbyScreen = $('#lobby-screen');
const gameScreen = $('#game-screen');
const gameoverScreen = $('#gameover-screen');

// ── Screen management ───────────────────────────────────────────────
function showScreen(screen) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ── How to Play data (fetched from server or inline) ────────────────
const howToPlayData = {
  classic: { title: 'Classic UNO', summary: 'The original UNO \u2014 match cards by color or number, use action cards to disrupt opponents, be the first to empty your hand.', playerCount: '2-10 players', setup: ['Each player is dealt 7 cards.','The remaining deck is placed face down as the draw pile.','The top card is flipped to start the discard pile.'], gameplay: ['On your turn, play a card that matches the top card by color, number, or symbol.','If you have no matching card, draw one from the pile.','Wild cards can be played on any card \u2014 you choose the next color.','Wild Draw 4 forces the next player to draw 4 and skip. Can be challenged.'], specialCards: [{card:'Skip',effect:'Next player loses their turn.'},{card:'Reverse',effect:'Reverses direction. In 2-player, acts as Skip.'},{card:'Draw 2',effect:'Next player draws 2 and loses their turn.'},{card:'Wild',effect:'Play on any card. Choose next color.'},{card:'Wild Draw 4',effect:'Next draws 4, skips. Choose color. Can be challenged.'}], winCondition: 'First to play all cards wins! Call UNO with one card left.', tips: ['Save Wilds for emergencies.','Keep a variety of colors.','Use action cards when opponents are close to winning.'] },
  stackable: { title: 'UNO Stackable', summary: 'Stack Draw 2s and Wild Draw 4s to pass the penalty to the next player!', playerCount: '2-10 players', setup: ['Same as Classic \u2014 7 cards each.'], gameplay: ['All Classic rules apply.','Draw 2 played on you? Stack another Draw 2 to pass +4 to the next player.','Wild Draw 4 can stack on Draw 2 or another Wild Draw 4.','Draw 2 CANNOT stack on Wild Draw 4.'], specialCards: [{card:'Draw 2',effect:'Stackable! Next draws 2 or stacks.'},{card:'Wild Draw 4',effect:'Stackable on any draw card.'}], winCondition: 'First to empty hand wins.', tips: ['Hold Draw cards for defense.','Stacks can reach 8+ cards!'] },
  sevenZero: { title: 'UNO 7-0 Rule', summary: 'Playing 7 swaps hands with any player. Playing 0 rotates all hands.', playerCount: '2-10 players', setup: ['Same as Classic \u2014 7 cards each.'], gameplay: ['All Classic rules apply.','Play a 7: swap your entire hand with any player.','Play a 0: all players pass hands in play direction.'], specialCards: [{card:'7',effect:'Swap hands with any player.'},{card:'0',effect:'All rotate hands in play direction.'}], winCondition: 'First to empty hand wins.', tips: ['Play 7 to steal a small hand!','Avoid 0 when your hand is small.'] },
  flip: { title: 'UNO Flip', summary: 'Double-sided cards! Flip switches between Light (mild) and Dark (brutal) side.', playerCount: '2-10 players', setup: ['7 cards each, starting on Light side.','Light: Red, Blue, Yellow, Green.','Dark: Teal, Orange, Pink, Purple.'], gameplay: ['Flip card switches everything to the other side.','Dark side has much harsher penalties.','Wild Draw Color: draw until you get the chosen color!'], specialCards: [{card:'Light: Draw 1',effect:'Next draws 1, skips.'},{card:'Light: Flip',effect:'Switch to Dark side.'},{card:'Dark: Draw 5',effect:'Next draws 5, skips.'},{card:'Dark: Skip Everyone',effect:'All others skip \u2014 you go again!'},{card:'Dark: Wild Draw Color',effect:'Draw until chosen color appears.'}], winCondition: 'First to empty hand wins.', tips: ['Time your flips strategically.','Wild Draw Color can be devastating.'] },
  noMercy: { title: 'UNO No Mercy', summary: 'The most brutal variant \u2014 Draw 6, Draw 10, Skip All, and all draws stackable!', playerCount: '2-10 players', setup: ['Expanded 168-card deck.','7 cards each.'], gameplay: ['All Classic rules plus extra cards.','ALL draw cards are stackable.','Skip All and Reverse All give you another turn.'], specialCards: [{card:'Draw 6',effect:'Stackable. Next draws 6 or stacks.'},{card:'Draw 10',effect:'Stackable. Next draws 10 or stacks.'},{card:'Skip All',effect:'Skip everyone \u2014 you go again!'},{card:'Reverse All',effect:'Reverse + skip all. You go again!'},{card:'Wild Draw 6/10',effect:'Stackable wild draw cards.'}], winCondition: 'First to empty hand wins. Good luck!', tips: ['This is war. Save draw cards.','A Draw 10 + Wild Draw 10 stack = 20 cards!'] },
  attack: { title: 'UNO Attack', summary: 'Hit the card launcher! Randomly shoots 0-4 cards at you.', playerCount: '2-10 players', setup: ['Modified deck with Hit cards.','7 cards each.'], gameplay: ['Hit cards force next player to press launcher.','Launcher randomly fires 0-4 cards per press.','~35% chance of firing nothing!'], specialCards: [{card:'Hit',effect:'Next hits launcher once.'},{card:'Hit 2',effect:'Next hits launcher twice.'},{card:'Wild Hit',effect:'Choose color, next hits once.'},{card:'Wild Hit 2',effect:'Choose color, next hits twice.'}], winCondition: 'First to empty hand wins.', tips: ['35% chance of 0 cards \u2014 sometimes you get lucky!','Hit 2 is brutal.'] },
  jumpIn: { title: 'UNO Jump-In', summary: 'Play an exact match out of turn \u2014 same color AND number!', playerCount: '2-10 players', setup: ['Same as Classic \u2014 7 cards each.'], gameplay: ['All Classic rules apply.','If you have an EXACT match (color + value) of the top card, play it out of turn!','Play continues from the player who jumped in.'], specialCards: [{card:'Exact match',effect:'Play out of turn.'}], winCondition: 'First to empty hand wins.', tips: ['Stay alert \u2014 watch the discard pile!','Jump-ins disrupt strategies.'] },
  elimination: { title: 'UNO Elimination', summary: 'Going out eliminates the player who enabled it! Last standing wins.', playerCount: '3-10 players', setup: ['Same as Classic \u2014 7 cards each.','Minimum 3 players.'], gameplay: ['All Classic rules apply.','When someone goes out, the player before them is eliminated.','Eliminated player\'s cards go to the winner of that round.','Game continues until one remains.'], specialCards: [{card:'Standard cards',effect:'Same as Classic.'}], winCondition: 'Last player standing wins!', tips: ['Careful when next player has few cards!','Use Skip/Reverse to avoid being the enabler.'] },
  team: { title: 'UNO Team (2v2)', summary: 'Partners! See your teammate\'s hand. Either partner going out wins.', playerCount: 'Exactly 4 (2v2)', setup: ['Players 1 & 3 = Team A, Players 2 & 4 = Team B.','Teammates can see each other\'s hands.','7 cards each.'], gameplay: ['All Classic rules apply.','You see your teammate\'s hand \u2014 coordinate!','Either partner going out wins for the team.'], specialCards: [{card:'Standard cards',effect:'Same as Classic.'}], winCondition: 'First team to have a member go out wins!', tips: ['Play colors your teammate has.','Protect your teammate with action cards.'] },
};

// ── Show How to Play Modal ──────────────────────────────────────────
function showHowToPlay(variant) {
  const data = howToPlayData[variant];
  if (!data) return;

  let html = `<h2>${data.title}</h2>`;
  html += `<p class="htp-summary">${data.summary}</p>`;
  html += `<p><strong>Players:</strong> ${data.playerCount}</p>`;

  html += '<h3>Setup</h3><ul>';
  data.setup.forEach(s => html += `<li>${s}</li>`);
  html += '</ul>';

  html += '<h3>How to Play</h3><ul>';
  data.gameplay.forEach(g => html += `<li>${g}</li>`);
  html += '</ul>';

  if (data.specialCards && data.specialCards.length > 0) {
    html += '<h3>Special Cards</h3><table class="htp-table"><tr><th>Card</th><th>Effect</th></tr>';
    data.specialCards.forEach(sc => html += `<tr><td>${sc.card}</td><td>${sc.effect}</td></tr>`);
    html += '</table>';
  }

  html += `<h3>Win Condition</h3><p>${data.winCondition}</p>`;

  if (data.tips && data.tips.length > 0) {
    html += '<h3>Tips</h3><ul>';
    data.tips.forEach(t => html += `<li>${t}</li>`);
    html += '</ul>';
  }

  $('#htp-content').innerHTML = html;
  $('#how-to-play-modal').style.display = 'flex';
}

// ── Card rendering ──────────────────────────────────────────────────
const CARD_SYMBOLS = {
  skip: '\u{1F6AB}',
  reverse: '\u{1F504}',
  draw2: '+2',
  draw1: '+1',
  draw5: '+5',
  draw6: '+6',
  draw10: '+10',
  wild: '\u{1F308}',
  wild4: '+4',
  wildDraw2: '+2',
  wildDrawColor: '+C',
  wildDraw6: '+6',
  wildDraw10: '+10',
  wildHit: 'HIT',
  wildHit2: 'HIT\u00D72',
  hit: 'HIT',
  hit2: 'HIT\u00D72',
  skipAll: '\u{1F6AB}ALL',
  reverseAll: '\u{1F504}ALL',
  flip: 'FLIP',
};

function getCardDisplay(card) {
  if (!card) return { symbol: '?', label: '?' };
  const val = card.value;
  if (!isNaN(parseInt(val))) return { symbol: val, label: val };
  return { symbol: CARD_SYMBOLS[val] || val, label: val.toUpperCase() };
}

function createCardElement(card, clickable = false, isJumpIn = false) {
  const el = document.createElement('div');
  el.className = `card card-${card.color}`;
  el.dataset.cardId = card.id;

  const display = getCardDisplay(card);
  el.innerHTML = `
    <span class="card-corner top">${display.symbol}</span>
    <span class="card-center">${display.symbol}</span>
    <span class="card-corner bottom">${display.symbol}</span>
  `;

  if (clickable) {
    el.classList.add('playable');
    el.addEventListener('click', () => {
      if (isJumpIn) {
        socket.emit('jumpIn', { cardId: card.id });
      } else if (card.color === 'wild') {
        pendingWildCard = card;
        showColorPicker();
      } else {
        socket.emit('playCard', { cardId: card.id });
      }
    });
  }

  return el;
}

// ── Color picker ────────────────────────────────────────────────────
function showColorPicker() {
  const modal = $('#color-picker-modal');
  const options = $('#color-options');

  // Determine valid colors based on variant/side
  let colors;
  if (currentVariant === 'flip' && gameState && gameState.activeSide === 'dark') {
    colors = [
      { name: 'teal', css: 'color-teal' },
      { name: 'orange', css: 'color-orange' },
      { name: 'pink', css: 'color-pink' },
      { name: 'purple', css: 'color-purple' },
    ];
  } else {
    colors = [
      { name: 'red', css: 'color-red' },
      { name: 'blue', css: 'color-blue' },
      { name: 'green', css: 'color-green' },
      { name: 'yellow', css: 'color-yellow' },
    ];
  }

  options.innerHTML = '';
  colors.forEach(c => {
    const btn = document.createElement('button');
    btn.className = `color-btn ${c.css}`;
    btn.dataset.color = c.name;
    btn.addEventListener('click', () => {
      if (pendingWildCard) {
        socket.emit('playCard', { cardId: pendingWildCard.id, chosenColor: c.name });
        pendingWildCard = null;
      }
      modal.style.display = 'none';
    });
    options.appendChild(btn);
  });

  modal.style.display = 'flex';
}

// ── Render game state ───────────────────────────────────────────────
function renderGame(state) {
  gameState = state;

  // Variant badge
  const variantNames = {
    classic: 'Classic', stackable: 'Stackable', sevenZero: '7-0 Rule',
    flip: 'Flip', noMercy: 'No Mercy', attack: 'Attack',
    jumpIn: 'Jump-In', elimination: 'Elimination', team: 'Team 2v2',
  };
  $('#game-variant').textContent = variantNames[state.variant] || state.variant;

  // Direction
  $('#game-direction').textContent = state.direction === 1 ? '\u27F3' : '\u27F2';

  // Draw stack
  if (state.drawStack > 0) {
    $('#draw-stack-display').style.display = 'inline';
    $('#draw-stack-display').textContent = `Stack: +${state.drawStack}`;
  } else {
    $('#draw-stack-display').style.display = 'none';
  }

  // Deck count
  $('#deck-count').textContent = state.deckCount;

  // Top card
  const topCardEl = $('#top-card');
  if (state.topCard) {
    topCardEl.className = `card card-${state.topCard.color}`;
    const display = getCardDisplay(state.topCard);
    topCardEl.innerHTML = `
      <span class="card-corner top">${display.symbol}</span>
      <span class="card-center">${display.symbol}</span>
      <span class="card-corner bottom">${display.symbol}</span>
    `;
  }

  // Current color indicator
  const colorInd = $('#current-color-indicator');
  colorInd.className = `color-indicator ci-${state.currentColor}`;
  colorInd.textContent = state.currentColor ? state.currentColor.toUpperCase() : '';

  // Find myself
  const me = state.players.find(p => p.id === myId);
  const isMyTurn = state.currentPlayerId === myId;

  // Opponents
  const opponentsEl = $('#opponents');
  opponentsEl.innerHTML = '';
  state.players.forEach((p, i) => {
    if (p.id === myId) return;
    const div = document.createElement('div');
    div.className = `opponent${p.isCurrent ? ' current-turn' : ''}${p.isEliminated ? ' eliminated' : ''}`;

    let handDisplay = '';
    if (p.hand) {
      // Team variant: show teammate's actual cards
      handDisplay = `<div class="opponent-hand-visible">`;
      p.hand.forEach(c => {
        handDisplay += `<div class="mini-card mini-${c.color}" title="${c.color} ${c.value}">${getCardDisplay(c).symbol}</div>`;
      });
      handDisplay += `</div>`;
    } else {
      // Show card backs
      const count = Math.min(p.cardCount, 10);
      handDisplay = `<div class="opponent-hand">`;
      for (let j = 0; j < count; j++) {
        handDisplay += `<div class="mini-card-back"></div>`;
      }
      if (p.cardCount > 10) handDisplay += `<span class="more-cards">+${p.cardCount - 10}</span>`;
      handDisplay += `</div>`;
    }

    let badges = '';
    if (p.isAI) badges += '<span class="badge badge-ai">AI</span>';
    if (p.team) badges += `<span class="badge badge-team-${p.team}">Team ${p.team}</span>`;
    if (p.calledUno && p.cardCount === 1) badges += '<span class="badge badge-uno">UNO!</span>';
    if (p.isEliminated) badges += '<span class="badge badge-eliminated">OUT</span>';

    // Challenge UNO button
    let challengeBtn = '';
    if (p.cardCount === 1 && !p.calledUno && !p.isAI) {
      challengeBtn = `<button class="btn btn-small btn-danger challenge-uno-btn" data-target="${p.id}">Catch!</button>`;
    }

    div.innerHTML = `
      <div class="opponent-info">
        <span class="opponent-name">${p.name}</span>
        <span class="opponent-count">${p.cardCount} card${p.cardCount !== 1 ? 's' : ''}</span>
        ${badges}
        ${challengeBtn}
      </div>
      ${handDisplay}
    `;
    opponentsEl.appendChild(div);
  });

  // Challenge UNO buttons
  document.querySelectorAll('.challenge-uno-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('challengeUno', { targetId: btn.dataset.target });
    });
  });

  // Player hand
  const handEl = $('#player-hand');
  handEl.innerHTML = '';
  if (me && me.hand) {
    me.hand.forEach(card => {
      const canPlay = isMyTurn && state.turnPhase === 'play';
      const isPlayable = canPlay && canPlayCardLocally(card, state);
      // Jump-in: can play exact matches even when not your turn
      const canJumpIn = state.variant === 'jumpIn' && !isMyTurn && state.topCard &&
        card.color === state.topCard.color && card.value === state.topCard.value;

      const el = createCardElement(card, isPlayable || canJumpIn, canJumpIn);
      handEl.appendChild(el);
    });
  }

  // Turn indicator
  const turnEl = $('#turn-indicator');
  if (isMyTurn) {
    turnEl.textContent = state.turnPhase === 'chooseSwapTarget' ? 'Choose a player to swap hands with!' :
      state.turnPhase === 'challengeWild4' ? 'Wild Draw 4! Challenge or Accept?' :
      state.drawStack > 0 ? `Stack +${state.drawStack} on you! Play a draw card or click Draw to accept.` :
      hasDrawnThisTurn ? 'You drew a card. Play it or pass.' :
      'Your turn! Play a card or draw.';
    turnEl.className = 'turn-indicator your-turn';
  } else {
    const current = state.players[state.currentPlayerIndex];
    turnEl.textContent = current ? `${current.name}'s turn` : 'Waiting...';
    turnEl.className = 'turn-indicator';
  }

  // UNO button visibility
  const unoBtn = $('#uno-btn');
  if (me && me.hand && me.hand.length === 2 && !me.calledUno && isMyTurn) {
    unoBtn.style.display = 'inline-block';
  } else if (me && me.hand && me.hand.length === 1 && !me.calledUno) {
    unoBtn.style.display = 'inline-block';
  } else {
    unoBtn.style.display = 'none';
  }

  // Show challenge modal if we need to respond to Wild Draw 4
  if (state.pendingWild4 && isMyTurn && state.turnPhase === 'challengeWild4') {
    $('#challenge-modal').style.display = 'flex';
  }

  // Show swap modal if in chooseSwapTarget phase
  if (isMyTurn && state.turnPhase === 'chooseSwapTarget') {
    showSwapModal(state);
  }

  // Draw pile click — disabled if we already drew this turn
  const drawPile = $('#draw-pile');
  drawPile.onclick = null;
  if (isMyTurn && !hasDrawnThisTurn && (state.turnPhase === 'play' || state.drawStack > 0)) {
    drawPile.classList.add('clickable');
    drawPile.onclick = () => socket.emit('drawCard');
  } else {
    drawPile.classList.remove('clickable');
  }

  // Pass button — shown when we drew and can play or pass
  const passArea = $('#pass-btn-area');
  if (isMyTurn && hasDrawnThisTurn) {
    passArea.style.display = 'flex';
  } else {
    passArea.style.display = 'none';
  }

  // Game log
  if (state.log && state.log.length > 0) {
    const logEl = $('#game-log');
    logEl.innerHTML = state.log.map(l => `<div class="log-entry">${l}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// ── Local card playability check (approximate, for UI hints) ────────
function canPlayCardLocally(card, state) {
  if (!state.topCard) return true;

  // Wild always playable
  if (card.color === 'wild') return true;

  // Draw stack active — only draw cards
  if (state.drawStack > 0) {
    const drawValues = ['draw2', 'draw6', 'draw10', 'wild4', 'wildDraw6', 'wildDraw10'];
    return drawValues.includes(card.value);
  }

  // Color match
  if (card.color === state.currentColor) return true;
  // Value match
  if (card.value === state.topCard.value) return true;

  return false;
}

// ── Show swap target modal ──────────────────────────────────────────
function showSwapModal(state) {
  const targetsEl = $('#swap-targets');
  targetsEl.innerHTML = '';

  state.players.forEach(p => {
    if (p.id === myId) return;
    if (p.isEliminated) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary swap-target-btn';
    btn.textContent = `${p.name} (${p.cardCount} cards)`;
    btn.addEventListener('click', () => {
      socket.emit('chooseSwapTarget', { targetId: p.id });
      $('#swap-modal').style.display = 'none';
    });
    targetsEl.appendChild(btn);
  });

  $('#swap-modal').style.display = 'flex';
}

// ── Game log helper ─────────────────────────────────────────────────
function addLogEntry(text) {
  const logEl = $('#game-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry log-highlight';
  entry.textContent = text;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  // Remove highlight after animation
  setTimeout(() => entry.classList.remove('log-highlight'), 2000);
}

// ── Socket events ───────────────────────────────────────────────────
socket.on('connect', () => {
  myId = socket.id;
});

socket.on('lobbyUpdate', (data) => {
  if (joinScreen.classList.contains('active')) return; // still on join screen
  showScreen(lobbyScreen);

  const listEl = $('#player-list');
  listEl.innerHTML = '';
  data.players.forEach(p => {
    const li = document.createElement('li');
    let badges = '';
    if (p.isHost) badges += ' <span class="badge badge-host">HOST</span>';
    if (p.isAI) badges += ' <span class="badge badge-ai">AI</span>';
    if (p.id === myId) badges += ' <span class="badge badge-you">YOU</span>';

    let removeBtn = '';
    if (isHost && p.id !== myId) {
      removeBtn = ` <button class="btn btn-tiny btn-danger remove-btn" data-pid="${p.id}">&times;</button>`;
    }

    li.innerHTML = `${p.name}${badges}${removeBtn}`;
    listEl.appendChild(li);
  });

  // Remove buttons
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('removePlayer', { playerId: btn.dataset.pid });
    });
  });

  $('#player-count').textContent = `(${data.players.length}/10)`;

  // Host controls
  isHost = data.hostId === myId;
  $('#host-controls').style.display = isHost ? 'block' : 'none';
  $('#waiting-msg').style.display = isHost ? 'none' : 'block';
});

socket.on('inProgress', () => {
  // Game already running, show message
  joinScreen.querySelector('.join-container').innerHTML += '<p class="error">A game is already in progress. Please wait.</p>';
});

socket.on('gameStart', (data) => {
  currentVariant = data.variant;
  showScreen(gameScreen);
});

socket.on('gameState', (state) => {
  showScreen(gameScreen);
  // Reset hasDrawnThisTurn if it's no longer our turn
  if (state.currentPlayerId !== myId) {
    hasDrawnThisTurn = false;
  }
  renderGame(state);
});

socket.on('action', (data) => {
  // Track if WE drew and can play the drawn card
  if (data.type === 'draw' && data.canPlayDrawn && data.playerId === myId) {
    hasDrawnThisTurn = true;
  }

  // Show action in log
  if (data.type === 'play') {
    addLogEntry(`${data.player} played ${data.card.color} ${data.card.value}${data.chosenColor && data.card.color === 'wild' ? ` (chose ${data.chosenColor})` : ''}`);
  } else if (data.type === 'draw') {
    addLogEntry(`${data.player} drew ${data.count} card${data.count !== 1 ? 's' : ''}`);
  } else if (data.type === 'drawStack') {
    addLogEntry(`${data.player} drew ${data.count} cards from the stack!`);
  } else if (data.type === 'callUno') {
    addLogEntry(`${data.player} called UNO!`);
  } else if (data.type === 'unoPenalty') {
    addLogEntry(`${data.target} was caught not calling UNO! Drew ${data.count} penalty cards.`);
  } else if (data.type === 'jumpIn') {
    addLogEntry(`${data.player} jumped in with ${data.card.color} ${data.card.value}!`);
  } else if (data.type === 'swapHands') {
    addLogEntry(`${data.from} swapped hands with ${data.to}!`);
  } else if (data.type === 'challengeWild4') {
    if (data.challengeSuccess) {
      addLogEntry(`Challenge successful! ${data.drawer} drew ${data.count} cards.`);
    } else {
      addLogEntry(`Challenge failed! ${data.drawer} drew ${data.count} cards.`);
    }
  } else if (data.type === 'acceptWild4') {
    addLogEntry(`${data.player} accepted and drew ${data.count} cards.`);
  }

  // Handle effects
  if (data.effects) {
    data.effects.forEach(eff => {
      if (typeof eff === 'object') {
        if (eff.type === 'attack') {
          addLogEntry(`${eff.player} hit the launcher: ${eff.count === 0 ? 'SAFE! No cards!' : `got ${eff.count} card${eff.count !== 1 ? 's' : ''}!`}`);
        }
        if (eff.type === 'flip') {
          addLogEntry(`FLIP! Now playing on the ${eff.side.toUpperCase()} side!`);
        }
        if (eff.type === 'rotateHands') {
          addLogEntry(`All hands rotated ${eff.direction === 1 ? 'clockwise' : 'counter-clockwise'}!`);
        }
        if (eff.type === 'eliminated') {
          addLogEntry(`${eff.player} has been ELIMINATED by ${eff.by}!`);
        }
        if (eff.type === 'teamWin') {
          addLogEntry(`Team ${eff.team} wins! ${eff.player} & ${eff.teammate}!`);
        }
        if (eff.type === 'drawUntilColor') {
          addLogEntry(`${eff.player} drew ${eff.count} cards looking for ${eff.color}!`);
        }
      }
    });
  }
});

socket.on('gameOver', (data) => {
  showScreen(gameoverScreen);

  let title = '';
  if (data.winnerTeam) {
    title = `Team ${data.winnerTeam} Wins!`;
  } else {
    title = `${data.winner} Wins!`;
  }
  $('#gameover-title').textContent = title;

  let details = `<p class="winner-score">Score: ${data.winnerScore} points</p>`;
  details += '<table class="scores-table"><tr><th>Player</th><th>Cards Left</th><th>Points</th></tr>';
  data.players.forEach(p => {
    const isWinner = p.name === data.winner;
    details += `<tr class="${isWinner ? 'winner-row' : ''}">
      <td>${p.name}${p.team ? ` (Team ${p.team})` : ''}</td>
      <td>${isWinner ? '0' : '-'}</td>
      <td>${p.handScore}</td>
    </tr>`;
  });
  details += '</table>';
  $('#gameover-details').innerHTML = details;
});

socket.on('error', (data) => {
  addLogEntry(`Error: ${data.message}`);
});

// ── UI event listeners ──────────────────────────────────────────────
$('#join-btn').addEventListener('click', () => {
  const name = $('#player-name').value.trim();
  if (!name) return;
  socket.emit('join', { name });
  showScreen(lobbyScreen);
});

$('#player-name').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') $('#join-btn').click();
});

$('#add-ai-btn').addEventListener('click', () => {
  socket.emit('addAI');
});

$('#start-btn').addEventListener('click', () => {
  const variant = $('#variant').value;
  socket.emit('startGame', { variant });
});

$('#how-to-play-btn').addEventListener('click', () => {
  showHowToPlay($('#variant').value);
});

$('#how-to-play-game-btn').addEventListener('click', () => {
  showHowToPlay(currentVariant);
});

$('#htp-close').addEventListener('click', () => {
  $('#how-to-play-modal').style.display = 'none';
});

$('#uno-btn').addEventListener('click', () => {
  socket.emit('callUno');
});

$('#pass-btn').addEventListener('click', () => {
  hasDrawnThisTurn = false;
  socket.emit('passTurn');
});

$('#challenge-yes').addEventListener('click', () => {
  socket.emit('challengeWild4');
  $('#challenge-modal').style.display = 'none';
});

$('#challenge-no').addEventListener('click', () => {
  socket.emit('acceptWild4');
  $('#challenge-modal').style.display = 'none';
});

$('#back-to-lobby-btn').addEventListener('click', () => {
  socket.emit('backToLobby');
  showScreen(lobbyScreen);
});

// Close modals on backdrop click
$$('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      // Don't close challenge or swap modals on backdrop
      if (modal.id === 'challenge-modal' || modal.id === 'swap-modal') return;
      modal.style.display = 'none';
      pendingWildCard = null;
    }
  });
});

// Variant select change — update how-to-play availability
$('#variant').addEventListener('change', () => {
  // Could show a preview, but for now just update the button
});
