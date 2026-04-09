'use strict';

// Team UNO — 2v2 partnerships, hands are visible to teammates
// Team A: players 0, 2 — Team B: players 1, 3
// A team wins when either partner plays their last card.
module.exports = {
  name: 'UNO Team',
  handSize: 7,
  canStack: false,
  playerCount: 4, // exactly 4

  onPlayerOut(player, game, result) {
    // Team wins!
    game.status = 'finished';
    game.winner = player;
    result.effects.push({
      type: 'teamWin',
      team: player.team,
      player: player.name,
      teammate: game.players.find(p => p.team === player.team && p.id !== player.id)?.name,
    });
    return result;
  },
};
