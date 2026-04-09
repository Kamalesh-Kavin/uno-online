'use strict';

// 7-0 Rule — Playing 7 swaps hands with chosen player, playing 0 rotates all hands
module.exports = {
  name: 'UNO 7-0 Rule',
  handSize: 7,
  canStack: false,

  onCardPlayed(card, player, game, result) {
    const value = game.getCardValue(card);

    if (value === '7') {
      // Player must choose someone to swap hands with
      // We set turnPhase and don't advance turn yet — GameState.applyCardEffect
      // already advanced, so we need to undo and set phase
      // Actually, we handle this by overriding: the number card case in applyCardEffect
      // calls advanceTurn, but we need to pause for swap selection.
      // We'll undo the advance and set phase instead.
      game.currentPlayerIndex = game.getPlayerIndex(player.id);
      game.turnPhase = 'chooseSwapTarget';
      result.effects.push({ type: 'awaitSwap', player: player.name });
    }

    if (value === '0') {
      // Rotate all hands in direction of play
      const active = game.getActivePlayers();
      if (active.length < 2) return;

      const hands = active.map(p => p.hand);
      const unoFlags = active.map(p => p.calledUno);

      if (game.direction === 1) {
        // Clockwise: each player gets the hand of the player before them
        const lastHand = hands[hands.length - 1];
        const lastUno = unoFlags[unoFlags.length - 1];
        for (let i = active.length - 1; i > 0; i--) {
          active[i].hand = hands[i - 1];
          active[i].calledUno = unoFlags[i - 1];
        }
        active[0].hand = lastHand;
        active[0].calledUno = lastUno;
      } else {
        // Counter-clockwise
        const firstHand = hands[0];
        const firstUno = unoFlags[0];
        for (let i = 0; i < active.length - 1; i++) {
          active[i].hand = hands[i + 1];
          active[i].calledUno = unoFlags[i + 1];
        }
        active[active.length - 1].hand = firstHand;
        active[active.length - 1].calledUno = firstUno;
      }

      result.effects.push({ type: 'rotateHands', direction: game.direction });
      game.log('All hands rotated!');
    }
  },
};
