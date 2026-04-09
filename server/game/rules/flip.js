'use strict';

// UNO Flip — Double-sided cards, Flip card switches Light/Dark
// Most logic is handled in GameState via activeSide checks.
// This rule module just defines the deck type and scoring.
module.exports = {
  name: 'UNO Flip',
  handSize: 7,
  canStack: false,
  deckType: 'flip',
};
