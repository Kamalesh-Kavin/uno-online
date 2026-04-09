'use strict';

// Jump-In UNO — Play identical card (same color + value) out of turn
// The jump-in logic is handled in GameState.jumpIn()
// This module just enables the flag.
module.exports = {
  name: 'UNO Jump-In',
  handSize: 7,
  canStack: false,
  allowJumpIn: true,
};
