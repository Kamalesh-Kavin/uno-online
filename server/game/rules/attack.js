'use strict';

// UNO Attack — Card launcher mechanic (simulated with random draw amounts)
module.exports = {
  name: 'UNO Attack',
  handSize: 7,
  canStack: false,
  deckType: 'attack',

  // Simulate the card launcher — returns random number of cards
  getHitCount(presses) {
    // Physical launcher: ~40% chance of 0, rest 1-4 cards per press
    // We simulate: each press has ~60% chance of firing 0-3 cards
    let total = 0;
    for (let p = 0; p < presses; p++) {
      const roll = Math.random();
      if (roll < 0.35) {
        total += 0; // Launcher didn't fire — lucky!
      } else if (roll < 0.60) {
        total += 1;
      } else if (roll < 0.80) {
        total += 2;
      } else if (roll < 0.93) {
        total += 3;
      } else {
        total += 4; // Jackpot spray
      }
    }
    return total;
  },
};
