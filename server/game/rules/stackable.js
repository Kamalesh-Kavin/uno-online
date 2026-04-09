'use strict';

// Stackable UNO — Draw 2s and Wild Draw 4s can be stacked
module.exports = {
  name: 'UNO Stackable',
  handSize: 7,
  canStack: true,

  // What cards can be added to a draw stack?
  canStackCard(card, game) {
    const value = game.getCardValue(card);
    const color = game.getCardColor(card);
    const topValue = game.getCardValue(game.getTopCard());

    // Draw 2 can stack on Draw 2 (any color)
    if (value === 'draw2' && topValue === 'draw2') return true;
    if (value === 'draw2' && topValue === 'wild4') return false; // can't put +2 on +4

    // Wild Draw 4 can stack on Draw 2 or Wild Draw 4
    if (value === 'wild4') return true;

    return false;
  },
};
