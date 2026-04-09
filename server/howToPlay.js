'use strict';

// ── How to Play text for all 9 UNO variants ─────────────────────────

const howToPlay = {
  classic: {
    title: 'Classic UNO',
    summary: 'The original UNO — match cards by color or number, use action cards to disrupt opponents, be the first to empty your hand.',
    playerCount: '2-10 players',
    setup: [
      'Each player is dealt 7 cards.',
      'The remaining deck is placed face down as the draw pile.',
      'The top card is flipped to start the discard pile (must be a number card).',
    ],
    gameplay: [
      'On your turn, play a card that matches the top card by color, number, or symbol.',
      'If you have no matching card, draw one from the pile. If the drawn card is playable, you may play it immediately.',
      'Wild cards can be played on any card — you choose the next color.',
      'Wild Draw 4 forces the next player to draw 4 cards and skip their turn. The next player may challenge it.',
    ],
    specialCards: [
      { card: 'Skip', effect: 'Next player loses their turn.' },
      { card: 'Reverse', effect: 'Reverses the direction of play. In 2-player, acts as Skip.' },
      { card: 'Draw 2', effect: 'Next player draws 2 cards and loses their turn.' },
      { card: 'Wild', effect: 'Play on any card. You choose the next color.' },
      { card: 'Wild Draw 4', effect: 'Next player draws 4, skips turn. You choose color. Can be challenged.' },
    ],
    winCondition: 'First player to play all their cards wins! Remember to call UNO when you have one card left.',
    tips: [
      'Save Wild cards for when you really need them.',
      'Try to keep a variety of colors in your hand.',
      'Watch opponents\' card counts — use action cards when they\'re close to winning.',
    ],
  },

  stackable: {
    title: 'UNO Stackable',
    summary: 'Classic UNO with the popular house rule — stack Draw 2s and Wild Draw 4s to pass the penalty to the next player!',
    playerCount: '2-10 players',
    setup: [
      'Same as Classic UNO — 7 cards each.',
    ],
    gameplay: [
      'All Classic UNO rules apply.',
      'When a Draw 2 is played on you, instead of drawing, you can play another Draw 2 — the next player then faces 4 cards.',
      'Wild Draw 4 can be stacked on Draw 2 or another Wild Draw 4.',
      'Draw 2 CANNOT be stacked on Wild Draw 4.',
      'Stacking continues until someone can\'t stack — they draw the total accumulated amount.',
    ],
    specialCards: [
      { card: 'Draw 2', effect: 'Stackable! Next player draws 2 OR stacks another Draw 2.' },
      { card: 'Wild Draw 4', effect: 'Stackable! Can be stacked on any draw card.' },
    ],
    winCondition: 'Same as Classic — first to empty their hand wins.',
    tips: [
      'Hold onto Draw cards for defense — you never know when you\'ll need to counter.',
      'Stacks can get brutal — a chain of 4 Draw 2s means someone draws 8!',
    ],
  },

  sevenZero: {
    title: 'UNO 7-0 Rule',
    summary: 'Playing a 7 lets you swap hands with any player. Playing a 0 rotates all hands in the direction of play.',
    playerCount: '2-10 players',
    setup: [
      'Same as Classic UNO — 7 cards each.',
    ],
    gameplay: [
      'All Classic UNO rules apply.',
      'When you play a 7, you MUST swap your entire hand with another player of your choice.',
      'When you play a 0, ALL players pass their entire hand to the next player in the current direction.',
      'After swapping/rotating, play continues normally from the next player.',
    ],
    specialCards: [
      { card: '7 (any color)', effect: 'Swap your entire hand with any player you choose.' },
      { card: '0 (any color)', effect: 'All players pass hands to the next player in play direction.' },
    ],
    winCondition: 'Same as Classic — first to empty their hand wins.',
    tips: [
      'Play a 7 to steal a small hand from an opponent about to win!',
      'Be careful playing 0 when you have few cards — you\'ll give away your advantage.',
      'The 7 is one of the most powerful cards in this variant.',
    ],
  },

  flip: {
    title: 'UNO Flip',
    summary: 'Double-sided cards! The Flip card switches between the Light (mild) side and Dark (brutal) side.',
    playerCount: '2-10 players',
    setup: [
      'Each player is dealt 7 cards, starting on the Light side.',
      'Light side colors: Red, Blue, Yellow, Green.',
      'Dark side colors: Teal, Orange, Pink, Purple.',
    ],
    gameplay: [
      'Play starts on the Light side with milder action cards.',
      'When a Flip card is played, EVERYTHING flips — the entire deck, discard pile, and all players\' hands turn to the other side.',
      'Dark side action cards are much more punishing.',
      'Wild Draw Color (dark) forces the next player to draw until they get a card of the chosen color!',
    ],
    specialCards: [
      { card: 'Light: Draw 1', effect: 'Next player draws 1 and skips.' },
      { card: 'Light: Wild Draw 2', effect: 'Next player draws 2, you choose color.' },
      { card: 'Light: Flip', effect: 'Switches to Dark side.' },
      { card: 'Dark: Draw 5', effect: 'Next player draws 5 and skips.' },
      { card: 'Dark: Skip Everyone', effect: 'Skip ALL other players — you go again!' },
      { card: 'Dark: Wild Draw Color', effect: 'Next player draws until they get the chosen color.' },
      { card: 'Dark: Flip', effect: 'Switches back to Light side.' },
    ],
    winCondition: 'First to empty their hand wins. Points scored based on whichever side is active when someone goes out.',
    tips: [
      'Flipping at the right moment can turn the game around.',
      'Wild Draw Color on the dark side can be devastating — someone might draw 10+ cards.',
      'Track which side benefits you more based on your hand.',
    ],
  },

  noMercy: {
    title: 'UNO No Mercy',
    summary: 'The most brutal UNO variant — Draw 6, Draw 10, Skip All, Reverse All, and all draw cards are stackable!',
    playerCount: '2-10 players',
    setup: [
      'Uses an expanded 168-card deck with extra brutal action cards.',
      'Each player is dealt 7 cards.',
    ],
    gameplay: [
      'All Classic UNO rules apply PLUS extra cards and stacking.',
      'Draw cards are STACKABLE — Draw 2, Draw 6, Draw 10, Wild Draw 4, Wild Draw 6, Wild Draw 10 can all chain.',
      'Skip All and Reverse All give you another turn immediately.',
      'No mercy means no mercy. Expect to draw huge amounts of cards.',
    ],
    specialCards: [
      { card: 'Draw 2', effect: 'Stackable. Next player draws 2 or stacks.' },
      { card: 'Draw 6', effect: 'Stackable. Next player draws 6 or stacks.' },
      { card: 'Draw 10', effect: 'Stackable. Next player draws 10 or stacks.' },
      { card: 'Skip All', effect: 'Skip ALL other players. You go again!' },
      { card: 'Reverse All', effect: 'Reverse direction AND skip all. You go again!' },
      { card: 'Wild Draw 4', effect: 'Stackable. Choose color, next draws 4 or stacks.' },
      { card: 'Wild Draw 6', effect: 'Stackable. Choose color, next draws 6 or stacks.' },
      { card: 'Wild Draw 10', effect: 'Stackable. Choose color, next draws 10 or stacks.' },
    ],
    winCondition: 'First to empty their hand wins. Good luck!',
    tips: [
      'This is war. Hold your draw cards for counterattacks.',
      'A stack of Draw 10 + Wild Draw 10 = someone draws 20 cards.',
      'Skip All is your best friend when you\'re close to winning.',
    ],
  },

  attack: {
    title: 'UNO Attack',
    summary: 'Instead of drawing from a pile, you hit the card launcher! It randomly shoots 0-4 cards at you.',
    playerCount: '2-10 players',
    setup: [
      'Uses a modified deck where Draw 2 and Wild Draw 4 are replaced with Hit and Wild Hit cards.',
      'Each player is dealt 7 cards.',
      'The card launcher is simulated digitally with random outcomes.',
    ],
    gameplay: [
      'Play matches by color, number, or symbol like Classic UNO.',
      'When you can\'t play, you "hit" the launcher instead of drawing from the pile.',
      'The launcher randomly fires 0-4 cards. You might get lucky with 0!',
      'Hit cards force the next player to press the launcher.',
    ],
    specialCards: [
      { card: 'Hit', effect: 'Next player hits the launcher once (0-4 cards).' },
      { card: 'Hit 2', effect: 'Next player hits the launcher TWICE.' },
      { card: 'Wild Hit', effect: 'Choose color. Next player hits launcher once.' },
      { card: 'Wild Hit 2', effect: 'Choose color. Next player hits launcher twice.' },
    ],
    winCondition: 'First to empty their hand wins.',
    tips: [
      'There\'s a ~35% chance the launcher fires nothing — sometimes you get lucky!',
      'Hit 2 is brutal — two presses means higher chance of cards.',
      'The randomness makes this variant exciting and unpredictable.',
    ],
  },

  jumpIn: {
    title: 'UNO Jump-In',
    summary: 'See an exact match on the discard pile? Play it instantly — even if it\'s not your turn!',
    playerCount: '2-10 players',
    setup: [
      'Same as Classic UNO — 7 cards each.',
    ],
    gameplay: [
      'All Classic UNO rules apply.',
      'If you have a card that is an EXACT match (same color AND same number/symbol) as the top card, you can play it OUT OF TURN.',
      'After a jump-in, play continues from the player who jumped in.',
      'You must be fast — once the next player starts their turn, the window closes.',
    ],
    specialCards: [
      { card: 'Any exact match', effect: 'Play out of turn if your card matches the top card exactly (color + value).' },
    ],
    winCondition: 'Same as Classic — first to empty their hand wins.',
    tips: [
      'Stay alert! Watch the discard pile at all times.',
      'Jump-ins can disrupt other players\' strategies.',
      'You can even jump in to go out and win!',
    ],
  },

  elimination: {
    title: 'UNO Elimination',
    summary: 'When someone goes out, the player who enabled it gets ELIMINATED! Last player standing wins.',
    playerCount: '3-10 players',
    setup: [
      'Same as Classic UNO — 7 cards each.',
      'Minimum 3 players required.',
    ],
    gameplay: [
      'All Classic UNO rules apply.',
      'When a player plays their last card and goes out, the player who played the card BEFORE them is eliminated.',
      'The eliminated player\'s remaining cards go to the player who went out.',
      'The game continues with the remaining players until only one is left.',
    ],
    specialCards: [
      { card: 'All standard cards', effect: 'Same as Classic UNO.' },
    ],
    winCondition: 'Last player standing wins! Going out eliminates someone, but you inherit their cards.',
    tips: [
      'Be very careful when the next player has few cards — you could be eliminated!',
      'Use Skip and Reverse to avoid being the "enabler" of someone going out.',
      'Sometimes it\'s better NOT to play a card if the next player is about to win.',
    ],
  },

  team: {
    title: 'UNO Team (2v2)',
    summary: 'Partner up! Team A vs Team B. You can see your teammate\'s hand. Either partner going out wins for the team.',
    playerCount: 'Exactly 4 players (2v2)',
    setup: [
      'Exactly 4 players required. Players 1 & 3 are Team A, Players 2 & 4 are Team B.',
      'Partners sit across from each other.',
      'All hands are visible to your teammate (but hidden from opponents).',
      '7 cards each.',
    ],
    gameplay: [
      'All Classic UNO rules apply.',
      'You can see your teammate\'s entire hand — coordinate your plays!',
      'When either partner plays their last card, that team wins immediately.',
      'Communication through card plays only — no verbal coordination!',
    ],
    specialCards: [
      { card: 'All standard cards', effect: 'Same as Classic UNO.' },
    ],
    winCondition: 'First TEAM to have a member go out wins!',
    tips: [
      'Play colors that help your teammate match.',
      'Use action cards to protect your teammate or disrupt the opposing team.',
      'Watch your teammate\'s hand and set them up to go out.',
    ],
  },
};

module.exports = howToPlay;
