'use strict';

// ── AI Decision Engine for UNO ──────────────────────────────────────
// Makes decisions based on game state, hand analysis, and variant-specific strategy.

class AI {
  static decide(game, playerId) {
    const player = game.getPlayer(playerId);
    if (!player) return { type: 'draw' };

    // First: call UNO if we have 2 cards and are about to play
    if (player.hand.length === 2 && !player.calledUno) {
      return { type: 'callUno' };
    }

    // If in chooseSwapTarget phase (7-0 rule), pick the player with fewest cards
    if (game.turnPhase === 'chooseSwapTarget') {
      return this.decideSwapTarget(game, player);
    }

    // If in challengeWild4 phase, decide whether to challenge
    if (game.turnPhase === 'challengeWild4' && game.pendingWild4) {
      return this.decideWild4Challenge(game, player);
    }

    // If there's a draw stack and we can stack, try to stack
    if (game.drawStack > 0 && game.rules.canStack) {
      const stackCard = this.findStackableCard(game, player);
      if (stackCard) {
        const color = this.chooseColor(player, game);
        return { type: 'play', cardId: stackCard.id, chosenColor: stackCard.color === 'wild' ? color : undefined };
      }
      // Can't stack — must draw
      return { type: 'draw' };
    }

    // Try to play a card
    const playable = this.getPlayableCards(game, player);
    if (playable.length > 0) {
      const chosen = this.chooseBestCard(game, player, playable);
      const color = chosen.color === 'wild' ? this.chooseColor(player, game) : undefined;
      return { type: 'play', cardId: chosen.id, chosenColor: color };
    }

    // No playable cards — draw
    return { type: 'draw' };
  }

  // ── Find all playable cards ─────────────────────────────────────
  static getPlayableCards(game, player) {
    return player.hand.filter(card => game.canPlayCard(card, player.id));
  }

  // ── Choose the best card to play ────────────────────────────────
  static chooseBestCard(game, player, playable) {
    // Score each card — higher is better to play
    const scored = playable.map(card => ({
      card,
      score: this.scoreCard(game, player, card),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].card;
  }

  static scoreCard(game, player, card) {
    const value = game.getCardValue(card);
    const color = game.getCardColor(card);
    let score = 0;

    const nextIdx = game.nextActiveIndex(game.currentPlayerIndex);
    const nextPlayer = game.players[nextIdx];
    const nextCardCount = nextPlayer ? nextPlayer.hand.length : 99;

    // Prefer playing high-point cards (get rid of them)
    score += game.getCardPoints(card) * 0.5;

    // Prefer action cards when next player has few cards
    if (nextCardCount <= 3) {
      if (value === 'skip' || value === 'skipAll') score += 30;
      if (value === 'reverse') score += 20;
      if (value === 'draw2') score += 25;
      if (value === 'draw6' || value === 'draw10') score += 35;
    }

    // Prefer number cards early (save action cards for defense)
    if (!isNaN(parseInt(value))) {
      if (player.hand.length > 4) score += 5;
    }

    // Save wilds for when we have no other options
    if (color === 'wild') {
      score -= 15;
      // But if we only have 2 cards left, play the non-wild first
      if (player.hand.length <= 2) score -= 30;
    }

    // 7-0 rule: play 7 when opponent has few cards (steal their small hand)
    if (game.variant === 'sevenZero' && value === '7') {
      const smallest = game.getActivePlayers()
        .filter(p => p.id !== player.id)
        .reduce((min, p) => p.hand.length < min ? p.hand.length : min, 99);
      if (smallest <= 2) score += 40;
    }

    // 7-0 rule: avoid playing 0 when our hand is small
    if (game.variant === 'sevenZero' && value === '0') {
      if (player.hand.length <= 3) score -= 30;
      else score += 5;
    }

    // Elimination: avoid enabling opponents to go out
    if (game.variant === 'elimination') {
      // Check if playing this card could let the next player win
      if (nextCardCount === 1) {
        score -= 40; // risky
      }
    }

    // Team: coordinate — prefer color that teammate has
    if (game.variant === 'team') {
      const teammate = game.players.find(p => p.team === player.team && p.id !== player.id);
      if (teammate && color !== 'wild') {
        const teammateHasColor = teammate.hand.some(c => game.getCardColor(c) === color);
        if (teammateHasColor) score += 15;
      }
    }

    // Prefer playing color we have the most of (keeps options open)
    const colorCount = player.hand.filter(c => game.getCardColor(c) === color).length;
    score += colorCount * 2;

    return score;
  }

  // ── Choose color for wild cards ─────────────────────────────────
  static chooseColor(player, game) {
    // Pick the color we have the most of (excluding wilds)
    const validColors = game.variant === 'flip' && game.activeSide === 'dark'
      ? ['teal', 'orange', 'pink', 'purple']
      : ['red', 'blue', 'green', 'yellow'];

    const counts = {};
    for (const c of validColors) counts[c] = 0;

    for (const card of player.hand) {
      const col = game.getCardColor(card);
      if (counts[col] !== undefined) counts[col]++;
    }

    let bestColor = validColors[0];
    let bestCount = 0;
    for (const [c, n] of Object.entries(counts)) {
      if (n > bestCount) { bestCount = n; bestColor = c; }
    }
    return bestColor;
  }

  // ── Find a card that can be stacked ─────────────────────────────
  static findStackableCard(game, player) {
    return player.hand.find(card => {
      if (game.rules.canStackCard) {
        return game.rules.canStackCard(card, game);
      }
      return false;
    });
  }

  // ── Decide swap target for 7-0 rule ─────────────────────────────
  static decideSwapTarget(game, player) {
    // Swap with the player who has the fewest cards
    const others = game.getActivePlayers().filter(p => p.id !== player.id);
    others.sort((a, b) => a.hand.length - b.hand.length);
    return { type: 'chooseSwapTarget', targetId: others[0].id };
  }

  // ── Decide whether to challenge Wild Draw 4 ────────────────────
  static decideWild4Challenge(game, player) {
    // Simple heuristic: challenge 30% of the time (it's risky)
    if (Math.random() < 0.3) {
      return { type: 'challengeWild4' };
    }
    return { type: 'acceptWild4' };
  }

  // ── Jump-in decision (called by AI loop proactively) ────────────
  static shouldJumpIn(game, playerId) {
    if (game.variant !== 'jumpIn') return null;
    if (game.players[game.currentPlayerIndex].id === playerId) return null;

    const player = game.getPlayer(playerId);
    if (!player) return null;

    const topCard = game.getTopCard();
    if (!topCard) return null;

    const topColor = game.getCardColor(topCard);
    const topValue = game.getCardValue(topCard);

    // Find exact match in hand
    const match = player.hand.find(c =>
      game.getCardColor(c) === topColor && game.getCardValue(c) === topValue
    );

    if (match) {
      // Jump in ~70% of the time when possible (adds unpredictability)
      if (Math.random() < 0.7) {
        return { type: 'jumpIn', cardId: match.id };
      }
    }
    return null;
  }
}

module.exports = AI;
