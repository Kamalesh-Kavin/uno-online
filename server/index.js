'use strict';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameState = require('./game/GameState');
const AI = require('./game/AI');

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Single lobby state ──────────────────────────────────────────────
let lobby = {
  players: [],   // { id, name, isAI, isHost }
  hostId: null
};
let game = null; // GameState instance when playing

// ── Helpers ─────────────────────────────────────────────────────────
function broadcastLobby() {
  io.emit('lobbyUpdate', {
    players: lobby.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI, isHost: p.isHost })),
    hostId: lobby.hostId
  });
}

function broadcastGameState() {
  if (!game) return;
  for (const p of lobby.players) {
    if (p.isAI) continue;
    const state = game.getSanitizedState(p.id);
    io.to(p.id).emit('gameState', state);
  }
}

function getPlayerName(id) {
  const p = lobby.players.find(pl => pl.id === id);
  return p ? p.name : 'Unknown';
}

function nextAIName() {
  const names = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Epsilon',
                 'Bot Zeta', 'Bot Eta', 'Bot Theta', 'Bot Iota'];
  const used = new Set(lobby.players.filter(p => p.isAI).map(p => p.name));
  return names.find(n => !used.has(n)) || `Bot ${lobby.players.filter(p => p.isAI).length + 1}`;
}

// ── AI turn loop ────────────────────────────────────────────────────
let aiTimer = null;
let aiCatchTimer = null;

function scheduleAITurn() {
  if (aiTimer) clearTimeout(aiTimer);
  if (!game || game.status !== 'playing') return;

  // Also check if any AI can catch someone who forgot UNO
  scheduleAICatchUno();

  const current = game.getCurrentPlayer();
  if (!current || !current.isAI) return;

  aiTimer = setTimeout(() => {
    if (!game || game.status !== 'playing') return;
    const cp = game.getCurrentPlayer();
    if (!cp || !cp.isAI) return;

    const action = AI.decide(game, cp.id);
    executeAction(cp.id, action);
  }, 800 + Math.random() * 600); // 0.8-1.4s delay for natural feel
}

// AI checks for uncalled UNO and catches them
function scheduleAICatchUno() {
  if (aiCatchTimer) clearTimeout(aiCatchTimer);
  if (!game || game.status !== 'playing') return;

  aiCatchTimer = setTimeout(() => {
    if (!game || game.status !== 'playing') return;

    // Find any player with 1 card who hasn't called UNO
    const uncalled = game.players.filter(p =>
      !p.isEliminated && p.hand.length === 1 && !p.calledUno
    );
    if (uncalled.length === 0) return;

    // Pick a random AI to do the catching (70% chance any AI notices)
    const aiPlayers = lobby.players.filter(p => p.isAI);
    if (aiPlayers.length === 0) return;

    for (const target of uncalled) {
      if (Math.random() < 0.7) {
        const catcher = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];
        const result = game.challengeUno(catcher.id, target.id);
        if (result && result.success) {
          io.emit('action', { player: getPlayerName(catcher.id), ...result });
          broadcastGameState();
        }
        break; // only catch one per check
      }
    }
  }, 1500 + Math.random() * 1000); // 1.5-2.5s delay to notice
}

function executeAction(playerId, action) {
  if (!game || game.status !== 'playing') return;

  let result;
  switch (action.type) {
    case 'play':
      result = game.playCard(playerId, action.cardId, action.chosenColor);
      break;
    case 'draw':
      result = game.drawCard(playerId);
      break;
    case 'callUno':
      result = game.callUno(playerId);
      // After calling UNO, AI still needs to act
      if (result && result.success) {
        scheduleAITurn();
        return;
      }
      break;
    case 'jumpIn':
      result = game.jumpIn(playerId, action.cardId);
      break;
    case 'chooseSwapTarget':
      result = game.chooseSwapTarget(playerId, action.targetId);
      break;
    case 'challengeWild4':
      result = game.challengeWild4(playerId);
      break;
    case 'acceptWild4':
      result = game.acceptWild4(playerId);
      break;
    default:
      return;
  }

  if (result && result.success) {
    io.emit('action', { player: getPlayerName(playerId), ...result });
    broadcastGameState();

    if (game.status === 'finished') {
      io.emit('gameOver', game.getGameOverData());
      game = null;
      return;
    }
  }

  scheduleAITurn();
}

// ── Socket.IO connection handling ───────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Send current state on connect
  if (game && game.status === 'playing') {
    socket.emit('inProgress');
  } else {
    socket.emit('lobbyUpdate', {
      players: lobby.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI, isHost: p.isHost })),
      hostId: lobby.hostId
    });
  }

  // ── Lobby events ────────────────────────────────────────────────
  socket.on('join', (data) => {
    if (game) return socket.emit('error', { message: 'Game already in progress' });
    if (lobby.players.length >= 10) return socket.emit('error', { message: 'Lobby is full (max 10)' });
    if (lobby.players.find(p => p.id === socket.id)) return;

    const name = (data.name || 'Player').substring(0, 16).trim() || 'Player';
    const isHost = lobby.players.length === 0;
    lobby.players.push({ id: socket.id, name, isAI: false, isHost });
    if (isHost) lobby.hostId = socket.id;

    broadcastLobby();
  });

  socket.on('addAI', () => {
    if (game) return;
    if (socket.id !== lobby.hostId) return socket.emit('error', { message: 'Only the host can add AI' });
    if (lobby.players.length >= 10) return socket.emit('error', { message: 'Lobby is full (max 10)' });

    const aiId = 'ai_' + Math.random().toString(36).substring(2, 8);
    lobby.players.push({ id: aiId, name: nextAIName(), isAI: true, isHost: false });
    broadcastLobby();
  });

  socket.on('removePlayer', (data) => {
    if (game) return;
    if (socket.id !== lobby.hostId) return;
    const idx = lobby.players.findIndex(p => p.id === data.playerId);
    if (idx === -1) return;
    lobby.players.splice(idx, 1);
    broadcastLobby();
  });

  socket.on('startGame', (data) => {
    if (socket.id !== lobby.hostId) return socket.emit('error', { message: 'Only the host can start' });

    const variant = data.variant || 'classic';
    const validVariants = ['classic', 'stackable', 'sevenZero', 'flip', 'noMercy', 'attack', 'jumpIn', 'elimination', 'team'];
    if (!validVariants.includes(variant)) return socket.emit('error', { message: 'Invalid variant' });

    // Validate player counts per variant
    const count = lobby.players.length;
    if (count < 2) return socket.emit('error', { message: 'Need at least 2 players' });
    if (variant === 'elimination' && count < 3) return socket.emit('error', { message: 'Elimination needs at least 3 players' });
    if (variant === 'team' && count !== 4) return socket.emit('error', { message: 'Team UNO needs exactly 4 players' });

    try {
      game = new GameState(lobby.players, variant);
      game.start();
      io.emit('gameStart', { variant });
      broadcastGameState();
      scheduleAITurn();
    } catch (err) {
      console.error('Failed to start game:', err);
      socket.emit('error', { message: 'Failed to start game: ' + err.message });
      game = null;
    }
  });

  // ── Game events ─────────────────────────────────────────────────
  socket.on('playCard', (data) => {
    if (!game || game.status !== 'playing') return;
    const result = game.playCard(socket.id, data.cardId, data.chosenColor);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), ...result });
      broadcastGameState();
      if (game.status === 'finished') {
        io.emit('gameOver', game.getGameOverData());
        game = null;
        return;
      }
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Invalid play' });
    }
  });

  socket.on('drawCard', () => {
    if (!game || game.status !== 'playing') return;
    const result = game.drawCard(socket.id);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), playerId: socket.id, ...result });
      broadcastGameState();
      if (game.status === 'finished') {
        io.emit('gameOver', game.getGameOverData());
        game = null;
        return;
      }
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Cannot draw right now' });
    }
  });

  socket.on('callUno', () => {
    if (!game || game.status !== 'playing') return;
    const result = game.callUno(socket.id);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), type: 'callUno' });
      broadcastGameState();
    }
  });

  socket.on('challengeUno', (data) => {
    if (!game || game.status !== 'playing') return;
    const result = game.challengeUno(socket.id, data.targetId);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), ...result });
      broadcastGameState();
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Invalid challenge' });
    }
  });

  socket.on('challengeWild4', () => {
    if (!game || game.status !== 'playing') return;
    const result = game.challengeWild4(socket.id);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), ...result });
      broadcastGameState();
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Invalid challenge' });
    }
  });

  socket.on('jumpIn', (data) => {
    if (!game || game.status !== 'playing') return;
    const result = game.jumpIn(socket.id, data.cardId);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), ...result });
      broadcastGameState();
      if (game.status === 'finished') {
        io.emit('gameOver', game.getGameOverData());
        game = null;
        return;
      }
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Cannot jump in' });
    }
  });

  socket.on('chooseSwapTarget', (data) => {
    if (!game || game.status !== 'playing') return;
    const result = game.chooseSwapTarget(socket.id, data.targetId);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), ...result });
      broadcastGameState();
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Invalid swap target' });
    }
  });

  socket.on('acceptWild4', () => {
    if (!game || game.status !== 'playing') return;
    const result = game.acceptWild4(socket.id);
    if (result && result.success) {
      io.emit('action', { player: getPlayerName(socket.id), ...result });
      broadcastGameState();
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Cannot accept right now' });
    }
  });

  socket.on('passTurn', () => {
    if (!game || game.status !== 'playing') return;
    const result = game.passTurn(socket.id);
    if (result && result.success) {
      broadcastGameState();
      scheduleAITurn();
    } else {
      socket.emit('error', { message: (result && result.message) || 'Cannot pass right now' });
    }
  });

  // ── Return to lobby ─────────────────────────────────────────────
  socket.on('backToLobby', () => {
    if (game) return;
    broadcastLobby();
  });

  // ── Disconnect ──────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const idx = lobby.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    lobby.players.splice(idx, 1);

    // If host left, reassign
    if (lobby.hostId === socket.id) {
      const newHost = lobby.players.find(p => !p.isAI);
      if (newHost) {
        newHost.isHost = true;
        lobby.hostId = newHost.id;
      } else {
        // All humans gone, reset
        lobby = { players: [], hostId: null };
        game = null;
        if (aiTimer) clearTimeout(aiTimer);
      }
    }

    if (game && game.status === 'playing') {
      // Replace disconnected player with AI
      const aiId = 'ai_' + Math.random().toString(36).substring(2, 8);
      game.replacePlayer(socket.id, aiId, getPlayerName(socket.id) + ' (AI)');
      const aiPlayer = { id: aiId, name: getPlayerName(socket.id), isAI: true, isHost: false };
      // Update lobby reference
      const lobbyIdx = lobby.players.findIndex(p => p.id === socket.id);
      if (lobbyIdx === -1) {
        lobby.players.push(aiPlayer);
      }
      broadcastGameState();
      scheduleAITurn();
    } else {
      broadcastLobby();
    }
  });
});

// ── Start server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`UNO server running on http://localhost:${PORT}`);
});
