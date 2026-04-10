'use strict';

// UNO No Mercy — Extreme version with Draw 6, Draw 10, Skip All, Reverse All
// Uses expanded deck. Draw cards fire immediately (not stackable) — "No Mercy" means
// you can't avoid the punishment. The extreme draw values make the game brutal enough.
module.exports = {
  name: 'UNO No Mercy',
  handSize: 7,
  canStack: false,
  deckType: 'noMercy',
};
