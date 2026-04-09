'use strict';

// ── Card Deck Definitions for all UNO variants ─────────────────────
// Each builder returns an array of card objects.

const COLORS = ['red', 'blue', 'green', 'yellow'];
const FLIP_LIGHT_COLORS = ['red', 'blue', 'yellow', 'green'];
const FLIP_DARK_COLORS = ['teal', 'orange', 'pink', 'purple'];

function makeId(color, value, idx) {
  return `${color[0]}${value}_${idx}`;
}

// ── Standard 108-card UNO deck ──────────────────────────────────────
function buildStandardDeck() {
  const cards = [];
  let idx = 0;

  for (const color of COLORS) {
    // One 0 per color
    cards.push({ id: makeId(color, '0', idx++), color, value: '0', points: 0 });
    // Two each of 1-9
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: makeId(color, String(n), idx++), color, value: String(n), points: n });
      cards.push({ id: makeId(color, String(n), idx++), color, value: String(n), points: n });
    }
    // Two each of Skip, Reverse, Draw Two
    for (let i = 0; i < 2; i++) {
      cards.push({ id: makeId(color, 'skip', idx++), color, value: 'skip', points: 20 });
      cards.push({ id: makeId(color, 'reverse', idx++), color, value: 'reverse', points: 20 });
      cards.push({ id: makeId(color, 'draw2', idx++), color, value: 'draw2', points: 20 });
    }
  }
  // Four Wild and four Wild Draw Four
  for (let i = 0; i < 4; i++) {
    cards.push({ id: makeId('wild', 'wild', idx++), color: 'wild', value: 'wild', points: 50 });
    cards.push({ id: makeId('wild', 'wild4', idx++), color: 'wild', value: 'wild4', points: 50 });
  }

  return cards; // 108 cards
}

// ── UNO Flip 112-card double-sided deck ─────────────────────────────
function buildFlipDeck() {
  const cards = [];
  let idx = 0;

  // We pair light and dark sides. The mapping is fixed per card.
  // Light side: red, blue, yellow, green with draw1, skip, reverse, flip, wild, wildDraw2
  // Dark side: teal, orange, pink, purple with draw5, skipAll, reverse, flip, wild, wildDrawColor

  const lightActions = ['skip', 'reverse', 'draw1', 'flip'];
  const darkActions = ['skip', 'reverse', 'draw5', 'flip'];

  for (let ci = 0; ci < 4; ci++) {
    const lc = FLIP_LIGHT_COLORS[ci];
    const dc = FLIP_DARK_COLORS[ci];

    // One 0 per color
    cards.push({
      id: `flip_${idx++}`, color: lc, value: '0', points: 0,
      darkColor: dc, darkValue: '0', darkPoints: 0, activeSide: 'light'
    });

    // Two each of 1-9
    for (let n = 1; n <= 9; n++) {
      for (let copy = 0; copy < 2; copy++) {
        cards.push({
          id: `flip_${idx++}`, color: lc, value: String(n), points: n,
          darkColor: dc, darkValue: String(n), darkPoints: n, activeSide: 'light'
        });
      }
    }

    // Two each of action cards
    for (let copy = 0; copy < 2; copy++) {
      for (let ai = 0; ai < lightActions.length; ai++) {
        const lPoints = lightActions[ai] === 'flip' ? 20 : (lightActions[ai] === 'draw1' ? 10 : 20);
        const dPoints = darkActions[ai] === 'draw5' ? 20 : (darkActions[ai] === 'flip' ? 20 : 20);
        cards.push({
          id: `flip_${idx++}`, color: lc, value: lightActions[ai], points: lPoints,
          darkColor: dc, darkValue: darkActions[ai], darkPoints: dPoints, activeSide: 'light'
        });
      }
    }
  }

  // Wild cards (4 Wild, 4 Wild Draw Two on light / Wild Draw Color on dark)
  for (let i = 0; i < 4; i++) {
    cards.push({
      id: `flip_${idx++}`, color: 'wild', value: 'wild', points: 40,
      darkColor: 'wild', darkValue: 'wild', darkPoints: 40, activeSide: 'light'
    });
    cards.push({
      id: `flip_${idx++}`, color: 'wild', value: 'wildDraw2', points: 50,
      darkColor: 'wild', darkValue: 'wildDrawColor', darkPoints: 60, activeSide: 'light'
    });
  }

  return cards; // 112 cards
}

// ── UNO No Mercy 168-card deck ──────────────────────────────────────
// Adds: Draw 6, Draw 10, Skip All, Reverse All on top of standard cards
function buildNoMercyDeck() {
  const cards = buildStandardDeck();
  let idx = cards.length;

  for (const color of COLORS) {
    // Two Draw 6 per color
    for (let i = 0; i < 2; i++) {
      cards.push({ id: makeId(color, 'draw6', idx++), color, value: 'draw6', points: 30 });
    }
    // One Draw 10 per color
    cards.push({ id: makeId(color, 'draw10', idx++), color, value: 'draw10', points: 40 });
    // One Skip All per color
    cards.push({ id: makeId(color, 'skipAll', idx++), color, value: 'skipAll', points: 30 });
    // One Reverse All per color (reverses AND skips to you again)
    cards.push({ id: makeId(color, 'reverseAll', idx++), color, value: 'reverseAll', points: 30 });
  }

  // Extra wilds: 4 more Wild Draw 4, 2 Wild Draw 6
  for (let i = 0; i < 4; i++) {
    cards.push({ id: makeId('wild', 'wild4', idx++), color: 'wild', value: 'wild4', points: 50 });
  }
  for (let i = 0; i < 2; i++) {
    cards.push({ id: makeId('wild', 'wildDraw6', idx++), color: 'wild', value: 'wildDraw6', points: 60 });
  }
  // Wild Draw 10
  for (let i = 0; i < 2; i++) {
    cards.push({ id: makeId('wild', 'wildDraw10', idx++), color: 'wild', value: 'wildDraw10', points: 80 });
  }

  return cards; // ~168 cards
}

// ── UNO Attack deck ─────────────────────────────────────────────────
// Similar to standard but Draw 2 and Wild Draw 4 are replaced with
// "Attack" cards (the launcher fires random 0-5 cards)
function buildAttackDeck() {
  const cards = [];
  let idx = 0;

  for (const color of COLORS) {
    cards.push({ id: makeId(color, '0', idx++), color, value: '0', points: 0 });
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: makeId(color, String(n), idx++), color, value: String(n), points: n });
      cards.push({ id: makeId(color, String(n), idx++), color, value: String(n), points: n });
    }
    for (let i = 0; i < 2; i++) {
      cards.push({ id: makeId(color, 'skip', idx++), color, value: 'skip', points: 20 });
      cards.push({ id: makeId(color, 'reverse', idx++), color, value: 'reverse', points: 20 });
      // "Hit" replaces Draw 2 — next player hits the launcher (random draw)
      cards.push({ id: makeId(color, 'hit', idx++), color, value: 'hit', points: 20 });
    }
    // One "Hit 2" per color — hit the launcher twice
    cards.push({ id: makeId(color, 'hit2', idx++), color, value: 'hit2', points: 20 });
  }

  // Wild cards
  for (let i = 0; i < 4; i++) {
    cards.push({ id: makeId('wild', 'wild', idx++), color: 'wild', value: 'wild', points: 50 });
    // Wild Hit replaces Wild Draw 4
    cards.push({ id: makeId('wild', 'wildHit', idx++), color: 'wild', value: 'wildHit', points: 50 });
  }
  // 2 Wild Hit-Hit (hit twice)
  for (let i = 0; i < 2; i++) {
    cards.push({ id: makeId('wild', 'wildHit2', idx++), color: 'wild', value: 'wildHit2', points: 50 });
  }

  return cards; // ~112 cards
}

// ── Deck factory ────────────────────────────────────────────────────
function buildDeck(variant) {
  switch (variant) {
    case 'flip':      return buildFlipDeck();
    case 'noMercy':   return buildNoMercyDeck();
    case 'attack':    return buildAttackDeck();
    default:          return buildStandardDeck();
  }
}

// ── Shuffle (Fisher-Yates) ──────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { buildDeck, shuffle, COLORS, FLIP_LIGHT_COLORS, FLIP_DARK_COLORS };
