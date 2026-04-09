'use strict';

// UNO No Mercy — Extreme version with Draw 6, Draw 10, Skip All, Reverse All
// Uses expanded deck. Draw cards are stackable in No Mercy.
module.exports = {
  name: 'UNO No Mercy',
  handSize: 7,
  canStack: true,
  deckType: 'noMercy',

  canStackCard(card, game) {
    const value = game.getCardValue(card);
    const topValue = game.getCardValue(game.getTopCard());

    // Any draw card can stack on any draw card
    const drawValues = ['draw2', 'draw6', 'draw10', 'wild4', 'wildDraw6', 'wildDraw10'];
    if (drawValues.includes(value) && drawValues.includes(topValue)) return true;

    return false;
  },
};
