'use strict';

// Elimination UNO — When someone goes out, the player who enabled it
// (played the card before them) gets eliminated. Last player standing wins.
module.exports = {
  name: 'UNO Elimination',
  handSize: 7,
  canStack: false,
  minPlayers: 3,

  onPlayerOut(player, game, result) {
    // The "enabler" is the player who played the card before the winner
    const enablerIdx = game.lastPlayedBy;

    // If the player who went out IS the enabler (they played their last card),
    // the enabler is the player who played before them (gave them the opening)
    // Actually, lastPlayedBy is set to the person who just played — that's the
    // player who went out. The enabler is the person who played BEFORE them,
    // which is the previous player in turn order.
    const prevIdx = game.prevActiveIndex(game.getPlayerIndex(player.id));
    const enabler = game.players[prevIdx];

    if (enabler && enabler.id !== player.id) {
      // Enabler is eliminated
      enabler.isEliminated = true;
      // Give enabler's cards to the player who went out
      player.hand = enabler.hand;
      enabler.hand = [];
      result.effects.push({ type: 'eliminated', player: enabler.name, by: player.name });
      game.log(`${enabler.name} was eliminated by ${player.name}!`);
    }

    // Check if only one player remains
    const remaining = game.getActivePlayers();
    if (remaining.length <= 1) {
      game.status = 'finished';
      game.winner = remaining[0] || player;
      result.effects.push({ type: 'win', player: game.winner.name });
      return result;
    }

    // Game continues — reset turn to next active player after current
    game.currentPlayerIndex = game.getPlayerIndex(player.id);
    game.advanceTurn();
    result.effects.push({ type: 'continueElimination', remaining: remaining.length });

    return result;
  },
};
