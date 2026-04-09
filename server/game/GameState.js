'use strict';

const { buildDeck, shuffle, COLORS } = require('../data/decks');

// ── Load rule modules ───────────────────────────────────────────────
const ruleModules = {
  classic:     require('./rules/classic'),
  stackable:   require('./rules/stackable'),
  sevenZero:   require('./rules/sevenZero'),
  flip:        require('./rules/flip'),
  noMercy:     require('./rules/noMercy'),
  attack:      require('./rules/attack'),
  jumpIn:      require('./rules/jumpIn'),
  elimination: require('./rules/elimination'),
  team:        require('./rules/team'),
};

class GameState {
  constructor(lobbyPlayers, variant) {
    this.variant = variant;
    this.rules = ruleModules[variant];
    if (!this.rules) throw new Error(`Unknown variant: ${variant}`);

    this.status = 'lobby'; // lobby | playing | finished
    this.players = lobbyPlayers.map((p, i) => ({
      id: p.id,
      name: p.name,
      isAI: p.isAI,
      hand: [],
      calledUno: false,
      isEliminated: false,
      team: null,
      score: 0,
    }));

    // Team assignment
    if (variant === 'team' && this.players.length === 4) {
      this.players[0].team = 'A';
      this.players[1].team = 'B';
      this.players[2].team = 'A';
      this.players[3].team = 'B';
    }

    this.deck = [];
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.direction = 1; // 1 = clockwise, -1 = counter
    this.currentColor = null;
    this.drawStack = 0; // for stackable/noMercy
    this.activeSide = 'light'; // for flip
    this.lastPlayedBy = null; // index of who played last (for elimination)
    this.turnPhase = 'play'; // play | draw | chooseColor | chooseSwapTarget | challengeWild4
    this.pendingWild4 = null; // { playerId, previousColor } for challenge
    this.winner = null;
    this.gameLog = [];
  }

  // ── Start the game ──────────────────────────────────────────────
  start() {
    this.deck = shuffle(buildDeck(this.variant));

    // Deal 7 cards to each player
    const handSize = this.rules.handSize || 7;
    for (const player of this.players) {
      for (let i = 0; i < handSize; i++) {
        player.hand.push(this.drawFromDeck());
      }
    }

    // Flip first card — must be a number card
    let firstCard = this.drawFromDeck();
    while (this.isActionOrWild(firstCard)) {
      this.deck.push(firstCard);
      shuffle(this.deck);
      firstCard = this.drawFromDeck();
    }
    this.discardPile.push(firstCard);
    this.currentColor = this.getCardColor(firstCard);

    this.status = 'playing';
    this.turnPhase = 'play';
    this.log(`Game started! Variant: ${this.variant}. First card: ${this.cardToString(firstCard)}`);
  }

  // ── Card helpers ────────────────────────────────────────────────
  getCardColor(card) {
    if (this.variant === 'flip' && this.activeSide === 'dark') {
      return card.darkColor;
    }
    return card.color;
  }

  getCardValue(card) {
    if (this.variant === 'flip' && this.activeSide === 'dark') {
      return card.darkValue;
    }
    return card.value;
  }

  getCardPoints(card) {
    if (this.variant === 'flip' && this.activeSide === 'dark') {
      return card.darkPoints || 0;
    }
    return card.points || 0;
  }

  isActionOrWild(card) {
    const val = this.getCardValue(card);
    return isNaN(parseInt(val));
  }

  cardToString(card) {
    return `${this.getCardColor(card)} ${this.getCardValue(card)}`;
  }

  getTopCard() {
    return this.discardPile[this.discardPile.length - 1] || null;
  }

  // ── Deck management ─────────────────────────────────────────────
  drawFromDeck() {
    if (this.deck.length === 0) {
      this.reshuffleDiscard();
    }
    if (this.deck.length === 0) return null; // truly empty
    return this.deck.pop();
  }

  reshuffleDiscard() {
    if (this.discardPile.length <= 1) return;
    const top = this.discardPile.pop();
    this.deck = shuffle(this.discardPile);
    this.discardPile = [top];
  }

  drawCards(playerId, count) {
    const player = this.getPlayer(playerId);
    if (!player) return [];
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const card = this.drawFromDeck();
      if (!card) break;
      player.hand.push(card);
      drawn.push(card);
    }
    player.calledUno = false; // no longer at 1 card
    return drawn;
  }

  // ── Player helpers ──────────────────────────────────────────────
  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  getPlayerIndex(id) {
    return this.players.findIndex(p => p.id === id);
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
  }

  getActivePlayers() {
    if (this.variant === 'elimination') {
      return this.players.filter(p => !p.isEliminated);
    }
    return this.players;
  }

  // ── Turn management ─────────────────────────────────────────────
  advanceTurn(skip = 0) {
    const active = this.getActivePlayers();
    if (active.length <= 1) return;

    let steps = 1 + skip;
    let idx = this.currentPlayerIndex;
    for (let i = 0; i < steps; i++) {
      idx = this.nextActiveIndex(idx);
    }
    this.currentPlayerIndex = idx;
    this.turnPhase = 'play';

    // Check if this player needs to handle a draw stack (stackable/noMercy)
    if (this.drawStack > 0 && this.rules.canStack) {
      this.turnPhase = 'play'; // they can stack or must draw
    }
  }

  nextActiveIndex(fromIdx) {
    const len = this.players.length;
    let idx = fromIdx;
    do {
      idx = (idx + this.direction + len) % len;
    } while (this.players[idx].isEliminated);
    return idx;
  }

  prevActiveIndex(fromIdx) {
    const len = this.players.length;
    let idx = fromIdx;
    do {
      idx = (idx - this.direction + len) % len;
    } while (this.players[idx].isEliminated);
    return idx;
  }

  // ── Core: Can play card? ────────────────────────────────────────
  canPlayCard(card, playerId) {
    const topCard = this.getTopCard();
    if (!topCard) return true;

    const cardColor = this.getCardColor(card);
    const cardValue = this.getCardValue(card);
    const topValue = this.getCardValue(topCard);

    // If there's an active draw stack (stackable), only stackable cards can be played
    if (this.drawStack > 0 && this.rules.canStack) {
      if (this.rules.canStackCard) return this.rules.canStackCard(card, this);
      return false;
    }

    // Wild cards can always be played (outside of draw stacks)
    if (cardColor === 'wild') return true;

    // Match color
    if (cardColor === this.currentColor) return true;
    // Match value
    if (cardValue === topValue) return true;

    // Variant-specific checks
    if (this.rules.canPlayExtra) {
      return this.rules.canPlayExtra(card, topCard, this);
    }

    return false;
  }

  // ── Core: Play a card ───────────────────────────────────────────
  playCard(playerId, cardId, chosenColor) {
    if (this.status !== 'playing') return { success: false, message: 'Game not in progress' };

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, message: 'Player not found' };

    // Must be current player's turn (unless jump-in, handled separately)
    if (this.players[this.currentPlayerIndex].id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }

    if (this.turnPhase === 'chooseSwapTarget' || this.turnPhase === 'challengeWild4') {
      return { success: false, message: 'Must complete current action first' };
    }

    // Find card in hand
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { success: false, message: 'Card not in your hand' };
    const card = player.hand[cardIdx];

    // Validate play
    if (!this.canPlayCard(card, playerId)) {
      return { success: false, message: 'Cannot play this card right now' };
    }

    // Remove from hand
    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);
    this.lastPlayedBy = this.currentPlayerIndex;

    const cardColor = this.getCardColor(card);
    const cardValue = this.getCardValue(card);

    // Determine new color
    if (cardColor === 'wild') {
      if (chosenColor && COLORS.includes(chosenColor)) {
        this.currentColor = chosenColor;
      } else if (this.variant === 'flip' && this.activeSide === 'dark') {
        const darkColors = ['teal', 'orange', 'pink', 'purple'];
        this.currentColor = (chosenColor && darkColors.includes(chosenColor)) ? chosenColor : darkColors[0];
      } else {
        this.currentColor = 'red'; // fallback
      }
    } else {
      this.currentColor = cardColor;
    }

    // Build result
    const result = {
      success: true,
      type: 'play',
      cardId: card.id,
      card: { color: this.getCardColor(card), value: this.getCardValue(card) },
      chosenColor: this.currentColor,
      effects: [],
    };

    // ── Check UNO call ──────────────────────────────────────────
    if (player.hand.length === 1) {
      // Player should call UNO — they have a brief window
      // (handled via calledUno flag + challengeUno)
    }
    if (player.hand.length > 1) {
      player.calledUno = false;
    }

    // ── Check win condition ─────────────────────────────────────
    if (player.hand.length === 0) {
      return this.handlePlayerOut(player, result);
    }

    // ── Apply card effects ──────────────────────────────────────
    this.applyCardEffect(cardValue, result);

    // Let variant rules react
    if (this.rules.onCardPlayed) {
      this.rules.onCardPlayed(card, player, this, result);
    }

    this.log(`${player.name} played ${this.cardToString(card)}${cardColor === 'wild' ? ` (chose ${this.currentColor})` : ''}`);

    return result;
  }

  // ── Apply standard card effects ─────────────────────────────────
  applyCardEffect(value, result) {
    switch (value) {
      case 'skip':
        result.effects.push('skip');
        this.advanceTurn(1); // skip next player
        return;

      case 'reverse':
        if (this.getActivePlayers().length === 2) {
          // In 2-player, reverse acts as skip
          result.effects.push('reverse');
          this.advanceTurn(1);
        } else {
          this.direction *= -1;
          result.effects.push('reverse');
          this.advanceTurn();
        }
        return;

      case 'draw2': {
        if (this.rules.canStack) {
          this.drawStack += 2;
          result.effects.push(`draw_stack_${this.drawStack}`);
          this.advanceTurn();
        } else {
          const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
          const nextPlayer = this.players[nextIdx];
          const drawn = this.drawCards(nextPlayer.id, 2);
          result.effects.push({ type: 'draw', player: nextPlayer.name, count: 2 });
          this.advanceTurn(1); // skip the player who drew
        }
        return;
      }

      case 'draw1': {
        // Flip light side
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        this.drawCards(nextPlayer.id, 1);
        result.effects.push({ type: 'draw', player: nextPlayer.name, count: 1 });
        this.advanceTurn(1);
        return;
      }

      case 'draw5': {
        // Flip dark side
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        this.drawCards(nextPlayer.id, 5);
        result.effects.push({ type: 'draw', player: nextPlayer.name, count: 5 });
        this.advanceTurn(1);
        return;
      }

      case 'draw6': {
        // No Mercy
        if (this.rules.canStack) {
          this.drawStack += 6;
          result.effects.push(`draw_stack_${this.drawStack}`);
          this.advanceTurn();
        } else {
          const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
          const nextPlayer = this.players[nextIdx];
          this.drawCards(nextPlayer.id, 6);
          result.effects.push({ type: 'draw', player: nextPlayer.name, count: 6 });
          this.advanceTurn(1);
        }
        return;
      }

      case 'draw10': {
        // No Mercy
        if (this.rules.canStack) {
          this.drawStack += 10;
          result.effects.push(`draw_stack_${this.drawStack}`);
          this.advanceTurn();
        } else {
          const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
          const nextPlayer = this.players[nextIdx];
          this.drawCards(nextPlayer.id, 10);
          result.effects.push({ type: 'draw', player: nextPlayer.name, count: 10 });
          this.advanceTurn(1);
        }
        return;
      }

      case 'skipAll':
        // No Mercy: skip all other players, you go again
        result.effects.push('skipAll');
        // Don't advance turn — current player goes again
        this.turnPhase = 'play';
        return;

      case 'reverseAll':
        // No Mercy: reverse + skip all, you go again
        this.direction *= -1;
        result.effects.push('reverseAll');
        this.turnPhase = 'play';
        return;

      case 'wild':
        this.advanceTurn();
        return;

      case 'wild4': {
        if (this.rules.canStack) {
          this.drawStack += 4;
          result.effects.push(`draw_stack_${this.drawStack}`);
          this.advanceTurn();
          // Allow challenge
          this.turnPhase = 'challengeWild4';
          this.pendingWild4 = {
            playerId: this.players[this.lastPlayedBy].id,
            previousColor: this.currentColor,
          };
        } else {
          // Next player can challenge or accept
          this.turnPhase = 'challengeWild4';
          this.pendingWild4 = {
            playerId: this.players[this.lastPlayedBy].id,
            previousColor: this.currentColor,
            drawCount: 4,
          };
          this.advanceTurn();
        }
        return;
      }

      case 'wildDraw2': {
        // Flip light wild draw 2
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        this.drawCards(nextPlayer.id, 2);
        result.effects.push({ type: 'draw', player: nextPlayer.name, count: 2 });
        this.advanceTurn(1);
        return;
      }

      case 'wildDrawColor': {
        // Flip dark: draw until you get the chosen color
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        let drawn = 0;
        const maxDraw = 20; // safety limit
        let gotColor = false;
        while (!gotColor && drawn < maxDraw) {
          const card = this.drawFromDeck();
          if (!card) break;
          nextPlayer.hand.push(card);
          drawn++;
          if (this.getCardColor(card) === this.currentColor) {
            gotColor = true;
          }
        }
        result.effects.push({ type: 'drawUntilColor', player: nextPlayer.name, count: drawn, color: this.currentColor });
        this.advanceTurn(1);
        return;
      }

      case 'wildDraw6': {
        // No Mercy
        if (this.rules.canStack) {
          this.drawStack += 6;
          result.effects.push(`draw_stack_${this.drawStack}`);
          this.advanceTurn();
        } else {
          const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
          const nextPlayer = this.players[nextIdx];
          this.drawCards(nextPlayer.id, 6);
          result.effects.push({ type: 'draw', player: nextPlayer.name, count: 6 });
          this.advanceTurn(1);
        }
        return;
      }

      case 'wildDraw10': {
        // No Mercy
        if (this.rules.canStack) {
          this.drawStack += 10;
          result.effects.push(`draw_stack_${this.drawStack}`);
          this.advanceTurn();
        } else {
          const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
          const nextPlayer = this.players[nextIdx];
          this.drawCards(nextPlayer.id, 10);
          result.effects.push({ type: 'draw', player: nextPlayer.name, count: 10 });
          this.advanceTurn(1);
        }
        return;
      }

      case 'flip': {
        // Toggle side
        this.activeSide = this.activeSide === 'light' ? 'dark' : 'light';
        // Update current color from top card
        const top = this.getTopCard();
        if (top) {
          const newColor = this.getCardColor(top);
          if (newColor !== 'wild') this.currentColor = newColor;
        }
        result.effects.push({ type: 'flip', side: this.activeSide });
        this.advanceTurn();
        return;
      }

      // Attack variant
      case 'hit': {
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        const hitCount = this.rules.getHitCount ? this.rules.getHitCount(1) : Math.floor(Math.random() * 4);
        if (hitCount > 0) {
          this.drawCards(nextPlayer.id, hitCount);
        }
        result.effects.push({ type: 'attack', player: nextPlayer.name, count: hitCount });
        this.advanceTurn(1);
        return;
      }

      case 'hit2': {
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        const hitCount = this.rules.getHitCount ? this.rules.getHitCount(2) : Math.floor(Math.random() * 6) + 1;
        if (hitCount > 0) {
          this.drawCards(nextPlayer.id, hitCount);
        }
        result.effects.push({ type: 'attack', player: nextPlayer.name, count: hitCount });
        this.advanceTurn(1);
        return;
      }

      case 'wildHit': {
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        const hitCount = this.rules.getHitCount ? this.rules.getHitCount(1) : Math.floor(Math.random() * 5) + 1;
        if (hitCount > 0) {
          this.drawCards(nextPlayer.id, hitCount);
        }
        result.effects.push({ type: 'attack', player: nextPlayer.name, count: hitCount });
        this.advanceTurn(1);
        return;
      }

      case 'wildHit2': {
        const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
        const nextPlayer = this.players[nextIdx];
        const hitCount = this.rules.getHitCount ? this.rules.getHitCount(2) : Math.floor(Math.random() * 8) + 2;
        if (hitCount > 0) {
          this.drawCards(nextPlayer.id, hitCount);
        }
        result.effects.push({ type: 'attack', player: nextPlayer.name, count: hitCount });
        this.advanceTurn(1);
        return;
      }

      default:
        // Number card — just advance turn
        this.advanceTurn();
        return;
    }
  }

  // ── Draw card (player action) ───────────────────────────────────
  drawCard(playerId) {
    if (this.status !== 'playing') return { success: false, message: 'Game not in progress' };

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, message: 'Player not found' };
    if (this.players[this.currentPlayerIndex].id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }

    // If there's a draw stack (stackable), player must accept it
    if (this.drawStack > 0 && this.rules.canStack) {
      const count = this.drawStack;
      this.drawStack = 0;
      const drawn = this.drawCards(playerId, count);
      this.log(`${player.name} drew ${count} cards (stack)`);
      this.advanceTurn(); // after drawing, turn passes (they already got skipped into)
      // Actually for stacking, the player who draws doesn't play — advance past them
      return {
        success: true,
        type: 'drawStack',
        count: count,
        cards: drawn.map(c => ({ id: c.id, color: this.getCardColor(c), value: this.getCardValue(c) })),
      };
    }

    // Normal draw: draw 1 card
    const drawn = this.drawCards(playerId, 1);
    if (drawn.length === 0) {
      this.advanceTurn();
      return { success: true, type: 'drawEmpty', count: 0 };
    }

    const drawnCard = drawn[0];
    this.log(`${player.name} drew a card`);

    // Can the drawn card be played immediately?
    if (this.canPlayCard(drawnCard, playerId)) {
      // Player can choose to play it or keep it — we'll auto-pass for now
      // The client will send a playCard event if they want to play it
      this.turnPhase = 'play'; // stay on this player's turn for one more action
      return {
        success: true,
        type: 'draw',
        count: 1,
        cards: [{ id: drawnCard.id, color: this.getCardColor(drawnCard), value: this.getCardValue(drawnCard) }],
        canPlayDrawn: true,
        drawnCardId: drawnCard.id,
      };
    }

    // Can't play it — turn passes
    this.advanceTurn();
    return {
      success: true,
      type: 'draw',
      count: 1,
      cards: [{ id: drawnCard.id, color: this.getCardColor(drawnCard), value: this.getCardValue(drawnCard) }],
      canPlayDrawn: false,
    };
  }

  // ── Pass turn (after drawing, chose not to play) ────────────────
  passTurn(playerId) {
    if (this.players[this.currentPlayerIndex].id !== playerId) {
      return { success: false, message: 'Not your turn' };
    }
    this.advanceTurn();
    return { success: true, type: 'pass' };
  }

  // ── UNO call ────────────────────────────────────────────────────
  callUno(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return { success: false };
    if (player.hand.length <= 2) {
      player.calledUno = true;
      this.log(`${player.name} called UNO!`);
      return { success: true, type: 'callUno' };
    }
    return { success: false, message: 'You have more than 2 cards' };
  }

  // ── Challenge UNO (catch someone who didn't call) ───────────────
  challengeUno(challengerId, targetId) {
    const target = this.getPlayer(targetId);
    if (!target) return { success: false, message: 'Target not found' };
    if (target.hand.length !== 1) return { success: false, message: 'Target does not have 1 card' };
    if (target.calledUno) return { success: false, message: 'Target already called UNO' };

    // Penalty: target draws 2
    const drawn = this.drawCards(targetId, 2);
    this.log(`${target.name} was caught not calling UNO! Drew 2 penalty cards`);
    return {
      success: true,
      type: 'unoPenalty',
      target: target.name,
      count: 2,
    };
  }

  // ── Challenge Wild Draw 4 ───────────────────────────────────────
  challengeWild4(challengerId) {
    if (!this.pendingWild4) return { success: false, message: 'No pending Wild Draw 4' };
    if (this.turnPhase !== 'challengeWild4') return { success: false, message: 'Cannot challenge now' };

    const challenger = this.getPlayer(challengerId);
    const playedBy = this.getPlayer(this.pendingWild4.playerId);
    if (!challenger || !playedBy) return { success: false };

    // Check if the player who played Wild Draw 4 had a card of the previous color
    const prevColor = this.pendingWild4.previousColor;
    const hadColor = playedBy.hand.some(c => this.getCardColor(c) === prevColor);

    const drawCount = this.pendingWild4.drawCount || 4;

    let result;
    if (hadColor) {
      // Challenge successful — player who played it draws instead
      const drawn = this.drawCards(playedBy.id, drawCount);
      this.log(`Challenge successful! ${playedBy.name} drew ${drawCount} cards`);
      result = {
        success: true,
        type: 'challengeWild4',
        challengeSuccess: true,
        drawer: playedBy.name,
        count: drawCount,
      };
    } else {
      // Challenge failed — challenger draws draw count + 2 penalty
      const totalDraw = drawCount + 2;
      const drawn = this.drawCards(challengerId, totalDraw);
      this.log(`Challenge failed! ${challenger.name} drew ${totalDraw} cards`);
      result = {
        success: true,
        type: 'challengeWild4',
        challengeSuccess: false,
        drawer: challenger.name,
        count: totalDraw,
      };
    }

    this.pendingWild4 = null;
    this.turnPhase = 'play';
    // If challenge failed, challenger already drew and was skipped effectively
    // If challenge succeeded, the current player (challenger) keeps their turn
    if (!result.challengeSuccess) {
      this.advanceTurn(); // skip challenger
    }

    return result;
  }

  // Accept Wild Draw 4 without challenging
  acceptWild4(playerId) {
    if (!this.pendingWild4) return { success: false };
    if (this.turnPhase !== 'challengeWild4') return { success: false };

    const drawCount = this.pendingWild4.drawCount || 4;
    const drawn = this.drawCards(playerId, drawCount);
    const player = this.getPlayer(playerId);
    this.log(`${player.name} accepted and drew ${drawCount} cards`);

    this.pendingWild4 = null;
    this.turnPhase = 'play';
    this.advanceTurn(); // skip this player

    return {
      success: true,
      type: 'acceptWild4',
      count: drawCount,
    };
  }

  // ── Jump-In (out-of-turn play for jumpIn variant) ───────────────
  jumpIn(playerId, cardId) {
    if (this.variant !== 'jumpIn') return { success: false, message: 'Jump-In not enabled' };
    if (this.players[this.currentPlayerIndex].id === playerId) {
      return { success: false, message: 'It is already your turn, use normal play' };
    }

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, message: 'Player not found' };

    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { success: false, message: 'Card not in hand' };
    const card = player.hand[cardIdx];

    // Jump-in requires exact match: same color AND same value as top card
    const topCard = this.getTopCard();
    if (!topCard) return { success: false };
    if (this.getCardColor(card) !== this.getCardColor(topCard) ||
        this.getCardValue(card) !== this.getCardValue(topCard)) {
      return { success: false, message: 'Jump-In requires exact match (same color and value)' };
    }

    // Valid jump-in
    player.hand.splice(cardIdx, 1);
    this.discardPile.push(card);
    this.currentColor = this.getCardColor(card);
    this.lastPlayedBy = this.getPlayerIndex(playerId);

    // Move turn to the player AFTER the one who jumped in
    this.currentPlayerIndex = this.getPlayerIndex(playerId);

    this.log(`${player.name} jumped in with ${this.cardToString(card)}!`);

    // Check win
    if (player.hand.length === 0) {
      const result = { success: true, type: 'jumpIn', card: { color: this.getCardColor(card), value: this.getCardValue(card) }, effects: [] };
      return this.handlePlayerOut(player, result);
    }

    this.advanceTurn();

    return {
      success: true,
      type: 'jumpIn',
      card: { color: this.getCardColor(card), value: this.getCardValue(card) },
      effects: [],
    };
  }

  // ── 7-0 Rule: Choose swap target ────────────────────────────────
  chooseSwapTarget(playerId, targetId) {
    if (this.turnPhase !== 'chooseSwapTarget') {
      return { success: false, message: 'Not choosing a swap target right now' };
    }

    const player = this.getPlayer(playerId);
    const target = this.getPlayer(targetId);
    if (!player || !target) return { success: false, message: 'Player not found' };
    if (playerId === targetId) return { success: false, message: 'Cannot swap with yourself' };

    // Swap hands
    const tempHand = player.hand;
    player.hand = target.hand;
    target.hand = tempHand;

    // Swap calledUno status
    const tempUno = player.calledUno;
    player.calledUno = target.calledUno;
    target.calledUno = tempUno;

    this.log(`${player.name} swapped hands with ${target.name}!`);

    this.turnPhase = 'play';
    this.advanceTurn();

    return {
      success: true,
      type: 'swapHands',
      from: player.name,
      to: target.name,
    };
  }

  // ── Handle player going out ─────────────────────────────────────
  handlePlayerOut(player, result) {
    this.log(`${player.name} played their last card!`);

    // Check if they called UNO before going out (they should have when at 2 cards)
    // Going out is still valid even without calling UNO

    // Apply any pending draw effects from the winning card
    // (e.g., if last card is a Draw 2, next player still draws)
    const lastCard = this.getTopCard();
    const lastValue = this.getCardValue(lastCard);

    // Handle draw effects even on winning card
    if (['draw2', 'draw6', 'draw10'].includes(lastValue) && !this.rules.canStack) {
      const drawCounts = { draw2: 2, draw6: 6, draw10: 10 };
      const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
      const nextPlayer = this.players[nextIdx];
      this.drawCards(nextPlayer.id, drawCounts[lastValue]);
      result.effects.push({ type: 'draw', player: nextPlayer.name, count: drawCounts[lastValue] });
    }

    if (lastValue === 'wild4') {
      const nextIdx = this.nextActiveIndex(this.currentPlayerIndex);
      const nextPlayer = this.players[nextIdx];
      this.drawCards(nextPlayer.id, 4);
      result.effects.push({ type: 'draw', player: nextPlayer.name, count: 4 });
    }

    // Variant-specific win handling
    if (this.rules.onPlayerOut) {
      const variantResult = this.rules.onPlayerOut(player, this, result);
      if (variantResult) return variantResult; // variant may override
    }

    // Standard win: game over
    this.status = 'finished';
    this.winner = player;
    result.effects.push({ type: 'win', player: player.name });

    return result;
  }

  // ── Replace disconnected player with AI ─────────────────────────
  replacePlayer(oldId, newId, newName) {
    const player = this.getPlayer(oldId);
    if (!player) return;
    player.id = newId;
    player.name = newName;
    player.isAI = true;
  }

  // ── Get sanitized state for a specific player ───────────────────
  getSanitizedState(playerId) {
    const viewer = this.getPlayer(playerId);
    const isTeamVariant = this.variant === 'team';

    return {
      variant: this.variant,
      status: this.status,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id,
      direction: this.direction,
      currentColor: this.currentColor,
      activeSide: this.activeSide,
      drawStack: this.drawStack,
      turnPhase: this.turnPhase,
      topCard: this.getTopCard() ? {
        id: this.getTopCard().id,
        color: this.getCardColor(this.getTopCard()),
        value: this.getCardValue(this.getTopCard()),
      } : null,
      deckCount: this.deck.length,
      discardCount: this.discardPile.length,
      players: this.players.map((p, i) => {
        const isViewer = p.id === playerId;
        const isTeammate = isTeamVariant && viewer && p.team === viewer.team;
        const showHand = isViewer || (isTeamVariant && isTeammate);

        return {
          id: p.id,
          name: p.name,
          isAI: p.isAI,
          cardCount: p.hand.length,
          hand: showHand ? p.hand.map(c => ({
            id: c.id,
            color: this.getCardColor(c),
            value: this.getCardValue(c),
          })) : null,
          calledUno: p.calledUno,
          isEliminated: p.isEliminated,
          team: p.team,
          isCurrent: i === this.currentPlayerIndex,
        };
      }),
      pendingWild4: this.pendingWild4 ? true : false,
      log: this.gameLog.slice(-10),
    };
  }

  // ── Game over data ──────────────────────────────────────────────
  getGameOverData() {
    // Score: winner gets points from all other players' hands
    let winnerScore = 0;
    const playerScores = this.players.map(p => {
      const handScore = p.hand.reduce((sum, c) => sum + this.getCardPoints(c), 0);
      if (this.winner && p.id !== this.winner.id) {
        winnerScore += handScore;
      }
      return { name: p.name, handScore, team: p.team };
    });

    return {
      winner: this.winner ? this.winner.name : null,
      winnerTeam: this.winner ? this.winner.team : null,
      winnerScore,
      players: playerScores,
      variant: this.variant,
    };
  }

  // ── Logging ─────────────────────────────────────────────────────
  log(message) {
    this.gameLog.push(message);
    if (this.gameLog.length > 100) this.gameLog.shift();
  }
}

module.exports = GameState;
