/**
 * Card Tactics — Tic Tac Toe Card Battle Logic with ActiveCards & PeerJS Multiplayer
 */

// DOM Elements
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const scoreXEl = document.getElementById('score-x');
const scoreOEl = document.getElementById('score-o');
const handXEl = document.getElementById('hand-x');
const handOEl = document.getElementById('hand-o');
const sectionXEl = document.getElementById('section-x');
const sectionOEl = document.getElementById('section-o');
const cardsXEl = document.getElementById('cards-x');
const cardsOEl = document.getElementById('cards-o');
const deckXEl = document.getElementById('deck-x');
const deckOEl = document.getElementById('deck-o');

const lobbyEl = document.getElementById('lobby');
const gameUiEl = document.getElementById('game-ui');
const hostBtn = document.getElementById('host-btn');
const joinBtn = document.getElementById('join-btn');
const joinCodeInput = document.getElementById('join-code');
const hostInfoEl = document.getElementById('host-info');
const gameCodeEl = document.getElementById('game-code');
const localBtn = document.getElementById('local-btn');

// Game State
const BOARD_SIZE = 5;
const WIN_LENGTH = 5;

let board = Array(BOARD_SIZE * BOARD_SIZE).fill(null); 
let handX = []; 
let handO = [];
let deckX = [];
let deckO = [];
let turn = 'X';
let gameOver = false;
let selectedCard = null; 
let actionState = null; 

// Multiplayer State
let peer = null;
let conn = null;
let myPlayer = null; // 'X' for host, 'O' for client

// Active Cards Data
let activeCardsData = [];
const possibleCounters = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_DECK_SIZE = 20;
const HAND_SIZE = 5;

function generateWinCombos() {
  const combos = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col <= BOARD_SIZE - WIN_LENGTH; col++) {
      const combo = [];
      for (let step = 0; step < WIN_LENGTH; step++) {
        combo.push(row * BOARD_SIZE + col + step);
      }
      combos.push(combo);
    }
  }

  for (let col = 0; col < BOARD_SIZE; col++) {
    for (let row = 0; row <= BOARD_SIZE - WIN_LENGTH; row++) {
      const combo = [];
      for (let step = 0; step < WIN_LENGTH; step++) {
        combo.push((row + step) * BOARD_SIZE + col);
      }
      combos.push(combo);
    }
  }

  for (let row = 0; row <= BOARD_SIZE - WIN_LENGTH; row++) {
    for (let col = 0; col <= BOARD_SIZE - WIN_LENGTH; col++) {
      const combo = [];
      for (let step = 0; step < WIN_LENGTH; step++) {
        combo.push((row + step) * BOARD_SIZE + col + step);
      }
      combos.push(combo);
    }
  }

  for (let row = 0; row <= BOARD_SIZE - WIN_LENGTH; row++) {
    for (let col = WIN_LENGTH - 1; col < BOARD_SIZE; col++) {
      const combo = [];
      for (let step = 0; step < WIN_LENGTH; step++) {
        combo.push((row + step) * BOARD_SIZE + col - step);
      }
      combos.push(combo);
    }
  }

  return combos;
}

const winCombos = generateWinCombos();

// Load Active Cards and setup UI listeners
async function loadAndInit() {
  try {
    const response = await fetch('ActiveCards.json');
    const data = await response.json();
    activeCardsData = data.ActiveCards || [];
  } catch (e) {
    console.error("Failed to load ActiveCards.json", e);
  }
  
  hostBtn.addEventListener('click', hostGame);
  joinBtn.addEventListener('click', joinGame);
  localBtn.addEventListener('click', startLocalPlay);
  resetBtn.addEventListener('click', requestReset);
}

// -----------------------------------------------------
// MULTIPLAYER NETWORKING & LOCAL PLAY
// -----------------------------------------------------

function startLocalPlay() {
  myPlayer = 'BOTH';
  board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  deckX = generateDeck('X');
  deckO = generateDeck('O');
  handX = drawCards(deckX, HAND_SIZE);
  handO = drawCards(deckO, HAND_SIZE);
  turn = 'X';
  gameOver = false;
  selectedCard = null;
  actionState = null;
  
  showGameUI();
  updateUI();
  updateStatus("Local Game Started! Player X goes first.");
}

function generateShortID() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function hostGame() {
  hostBtn.disabled = true;
  joinBtn.disabled = true;
  const roomCode = generateShortID();
  
  peer = new Peer(roomCode);
  
  peer.on('open', (id) => {
    myPlayer = 'X';
    hostInfoEl.style.display = 'block';
    gameCodeEl.textContent = id;
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
    startGameAsHost();
  });
}

function joinGame() {
  const roomCode = joinCodeInput.value.trim().toUpperCase();
  if (!roomCode) return;
  
  hostBtn.disabled = true;
  joinBtn.disabled = true;
  
  peer = new Peer();
  
  peer.on('open', (id) => {
    myPlayer = 'O';
    conn = peer.connect(roomCode);
    
    conn.on('open', () => {
      setupConnection();
    });
    
    conn.on('error', (err) => {
      alert("Connection failed. Check code.");
      location.reload();
    });
  });
}

function setupConnection() {
  conn.on('data', (data) => {
    if (data.type === 'INIT_STATE') {
      board = data.board;
      handX = data.handX;
      handO = data.handO;
      deckX = data.deckX || [];
      deckO = data.deckO || [];
      turn = data.turn;
      gameOver = data.gameOver;
      showGameUI();
      updateUI();
      updateStatus("Game Started! Player X goes first.");
    } else if (data.type === 'SYNC_STATE') {
      // Direct state sync after a move
      board = data.board;
      handX = data.handX;
      handO = data.handO;
      deckX = data.deckX || [];
      deckO = data.deckO || [];
      turn = data.turn;
      gameOver = data.gameOver;
      updateUI();
      if (!gameOver) {
        updateStatus(`Player ${turn === 'X' ? '✕' : '◯'} — Select a card`);
      }
    } else if (data.type === 'RESET') {
      if (myPlayer === 'X') {
        // Host re-inits and sends state
        board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
        deckX = generateDeck('X');
        deckO = generateDeck('O');
        handX = drawCards(deckX, HAND_SIZE);
        handO = drawCards(deckO, HAND_SIZE);
        turn = 'X';
        gameOver = false;
        selectedCard = null;
        actionState = null;
        syncState();
      }
    }
  });
}

function showGameUI() {
  lobbyEl.style.display = 'none';
  gameUiEl.style.display = 'flex';
}

function startGameAsHost() {
  board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  deckX = generateDeck('X');
  deckO = generateDeck('O');
  handX = drawCards(deckX, HAND_SIZE);
  handO = drawCards(deckO, HAND_SIZE);
  turn = 'X';
  gameOver = false;
  selectedCard = null;
  actionState = null;
  
  // Send initial state to client
  conn.send({
    type: 'INIT_STATE',
    board, handX, handO, deckX, deckO, turn, gameOver
  });
  
  showGameUI();
  updateUI();
  updateStatus("Game Started! Your turn.");
}

function syncState() {
  if (conn && conn.open) {
    conn.send({
      type: 'SYNC_STATE',
      board, handX, handO, deckX, deckO, turn, gameOver
    });
  }
  updateUI();
}

function requestReset() {
  if (myPlayer === 'BOTH') {
    startLocalPlay();
  } else if (myPlayer === 'X') {
    // I am host, just do it
    board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    deckX = generateDeck('X');
    deckO = generateDeck('O');
    handX = drawCards(deckX, HAND_SIZE);
    handO = drawCards(deckO, HAND_SIZE);
    turn = 'X';
    gameOver = false;
    selectedCard = null;
    actionState = null;
    syncState();
  } else {
    // Send reset request to host
    conn.send({ type: 'RESET' });
  }
}


// -----------------------------------------------------
// GAME LOGIC
// -----------------------------------------------------

function generateDeck(player) {
  // Check if player has a custom deck saved
  if (player === myPlayer || myPlayer === 'BOTH') {
    const saved = localStorage.getItem('customDeck');
    if (saved) {
      try {
        const deck = JSON.parse(saved);
        if (Array.isArray(deck) && deck.length === MAX_DECK_SIZE) {
          return deck.map((card, i) => ({
            type: card.type,
            value: card.value === '?' ? 0 : card.value,
            name: card.name,
            description: card.description || getCardDescription(card),
            id: `${player}-${i}`
          }));
        }
      } catch (e) {
        console.error("Failed to parse custom deck", e);
      }
    }
  }

  // Fallback to random generation
  const deck = [];
  for (let i = 0; i < MAX_DECK_SIZE; i++) {
    const isCounter = Math.random() < 0.7 || activeCardsData.length === 0;
    
    if (isCounter) {
      const val = possibleCounters[Math.floor(Math.random() * possibleCounters.length)];
      deck.push({
        type: 'counter',
        value: val,
        name: val.toString(),
        description: 'Standard number counter. Can capture lower values.',
        id: `${player}-${i}`
      });
    } else {
      const activeData = activeCardsData[Math.floor(Math.random() * activeCardsData.length)];
      deck.push({
        type: 'active',
        value: 0,
        name: activeData.name,
        description: activeData.description,
        id: `${player}-${i}`
      });
    }
  }
  return deck;
}

function getCardDescription(card) {
  if (card.type === 'counter') return 'Standard number counter. Can capture lower values.';
  const activeCard = activeCardsData.find(({ name }) => name === card.name);
  return activeCard ? activeCard.description : '';
}

function drawCards(deck, count) {
  return deck.splice(0, count);
}

function drawReplacement(player) {
  const hand = player === 'X' ? handX : handO;
  const deck = player === 'X' ? deckX : deckO;
  if (hand.length < HAND_SIZE && deck.length > 0) {
    hand.push(deck.shift());
  }
}

function updateUI() {
  renderBoard();
  renderHands();
  updateScores();
  updateTurnIndicators();
}

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.className = `board turn-${turn.toLowerCase()}`;
  boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, var(--cell-size))`;
  boardEl.style.gridTemplateRows = `repeat(${BOARD_SIZE}, var(--cell-size))`;

  board.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'board-cell';
    
    if (!cell) {
      div.classList.add('empty');
      if (selectedCard && !gameOver && isTargetValid(i) && (turn === myPlayer || myPlayer === 'BOTH')) {
        div.classList.add('valid-target');
      }
    } else {
      div.classList.add('occupied');
      div.classList.add(`owner-${cell.owner.toLowerCase()}`);
      if (cell.isShielded) div.style.border = "4px solid gold"; 
      
      const cardContent = document.createElement('div');
      cardContent.className = 'cell-card';
      cardContent.innerHTML = `
        <span class="cell-owner">${cell.owner === 'X' ? '✕' : '◯'}</span>
        <span class="cell-value">${cell.value}</span>
      `;
      div.appendChild(cardContent);

      if (selectedCard && !gameOver && isTargetValid(i) && (turn === myPlayer || myPlayer === 'BOTH')) {
        div.classList.add('valid-target');
      }
    }

    div.addEventListener('click', () => handleCellClick(i));
    boardEl.appendChild(div);
  });
}

function isTargetValid(cellIndex) {
  if (!selectedCard) return false;
  const hand = turn === 'X' ? handX : handO;
  const playedCard = hand[selectedCard.index];
  const cell = board[cellIndex];

  if (playedCard.type === 'counter') {
    if (!cell) return true; 
    if (cell.owner !== turn && !cell.isShielded && playedCard.value > (typeof cell.value === 'number' ? cell.value : 999)) return true; 
    return false;
  }
  
  if (playedCard.type === 'active') {
    if (playedCard.name === 'Bomb') return cell !== null; 
    if (playedCard.name === 'Atomic') return cell !== null; 
    if (playedCard.name === 'Shield') return cell !== null && cell.owner === turn; 
    if (playedCard.name === 'King') return !cell; 
    if (playedCard.name === 'Queen') return !cell; 
    if (playedCard.name === 'Swap') return cell !== null; 
    if (playedCard.name === 'castle') return !cell; // Fix for user's castle addition
    if (playedCard.name === 'Clone') {
      if (actionState && actionState.type === 'clone_place') return !cell; 
      return cell !== null; 
    }
    if (playedCard.name === 'DoubleShot') return !cell; 
    if (playedCard.name === 'gamble') return !cell; 
  }
  return false;
}

function renderHands() {
  renderHand(handX, 'X', handXEl);
  renderHand(handO, 'O', handOEl);
  cardsXEl.textContent = `${handX.length} card${handX.length !== 1 ? 's' : ''}`;
  cardsOEl.textContent = `${handO.length} card${handO.length !== 1 ? 's' : ''}`;
  deckXEl.textContent = `${deckX.length} card${deckX.length !== 1 ? 's' : ''}`;
  deckOEl.textContent = `${deckO.length} card${deckO.length !== 1 ? 's' : ''}`;
}

function renderHand(hand, player, containerEl) {
  containerEl.innerHTML = '';
  hand.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = `card player-${player.toLowerCase()}`;
    
    if (card.used) {
      div.classList.add('used');
    } else if (turn === player && (myPlayer === player || myPlayer === 'BOTH') && !gameOver && !actionState) {
      // Only your own cards are playable during your turn (or both in local play)
      div.classList.add('playable');
      if (selectedCard && selectedCard.player === player && selectedCard.index === i) div.classList.add('selected');
      div.addEventListener('click', () => handleCardClick(player, i));
    } else {
      div.classList.add('inactive');
    }
    
    const typeClass = card.type === 'active' ? 'type-active' : 'type-counter';
    const typeLabel = card.type === 'active' ? 'Spell' : 'Unit';
    const displayValue = card.type === 'active' ? '?' : card.value;

    div.innerHTML = `
      <div class="card-inner">
        <div class="card-header">
          <span class="card-name">${card.name}</span>
          <span class="card-type ${typeClass}">${typeLabel}</span>
        </div>
        <div class="card-body">
          <span class="card-value">${displayValue}</span>
        </div>
        <div class="card-footer">
          <span class="card-ability">${card.description || getCardDescription(card)}</span>
        </div>
      </div>
    `;
    
    // Hide opponent's unused cards face down! (Unless local play)
    if (player !== myPlayer && myPlayer !== 'BOTH' && !card.used) {
      div.innerHTML = `<div class="card-inner" style="background: repeating-linear-gradient(45deg, var(--line), var(--line) 10px, transparent 10px, transparent 20px);"></div>`;
    }

    containerEl.appendChild(div);
  });
}

function handleCardClick(player, index) {
  // Can only click if it's your turn, and you own the hand, and game isn't over
  if (gameOver || player !== turn || (player !== myPlayer && myPlayer !== 'BOTH') || actionState) return;
  const hand = player === 'X' ? handX : handO;
  if (!hand[index]) return;
  
  if (selectedCard && selectedCard.player === player && selectedCard.index === index) {
    selectedCard = null;
    updateStatus(`Player ${player === 'X' ? '✕' : '◯'} — Select a card`);
  } else {
    selectedCard = { player, index };
    updateStatus(`Player ${player === 'X' ? '✕' : '◯'} — Select a target cell`);
  }
  updateUI();
}

function handleCellClick(index) {
  if (gameOver || !selectedCard || (turn !== myPlayer && myPlayer !== 'BOTH')) return;
  if (!isTargetValid(index)) return;

  const hand = turn === 'X' ? handX : handO;
  const playedCard = hand[selectedCard.index];
  
  let turnComplete = false;

  if (playedCard.type === 'counter') {
    board[index] = { owner: turn, value: playedCard.value, isShielded: false };
    turnComplete = true;
  } else if (playedCard.type === 'active') {
    turnComplete = handleActiveCard(playedCard, index);
  }

  if (turnComplete) {
    hand.splice(selectedCard.index, 1);
    drawReplacement(turn);
    selectedCard = null;
    actionState = null;
    if (!checkEndGame()) {
      turn = turn === 'X' ? 'O' : 'X';
      updateStatus(`Player ${turn === 'X' ? '✕' : '◯'} — Select a card`);
    }
    syncState(); // Send move to other player
  } else {
    // If turn is not complete (e.g. multi-step action), just update local UI for now
    updateUI();
  }
}

function handleActiveCard(card, index) {
  const cell = board[index];

  if (card.name === 'Bomb') {
    board[index] = null; 
    return true;
  }
  if (card.name === 'Shield') {
    board[index].isShielded = true;
    return true;
  }
  if (card.name === 'King') {
    board[index] = { owner: turn, value: 'King', isShielded: false }; 
    return true;
  }
  if (card.name === 'Queen') {
    board[index] = { owner: turn, value: 'Queen', isShielded: false };
    return true;
  }
  if (card.name === 'castle') { // Fixed user's syntax
    board[index] = { owner: turn, value: 'castle', isShielded: true };
    return true;
  }
  if (card.name === 'gamble') {
    // Handle gamble card logic
    const randVal = possibleCounters[Math.floor(Math.random() * possibleCounters.length)];
    board[index] = { owner: turn, value: randVal, isShielded: false };
    return true;
  }

  if (card.name === 'Atomic'){
    board[index] = null; 
    return true;
  }

  if (card.name === 'DoubleShot') {
    if (!actionState) {
      const randVal = possibleCounters[Math.floor(Math.random() * possibleCounters.length)];
      board[index] = { owner: turn, value: randVal, isShielded: false };
      actionState = { type: 'doubleshot' };
      updateStatus("DoubleShot: Select second empty cell");
      return false;
    } else {
      const randVal = possibleCounters[Math.floor(Math.random() * possibleCounters.length)];
      board[index] = { owner: turn, value: randVal, isShielded: false };
      return true;
    }
  }

  if (card.name === 'Swap') {
    if (!actionState) {
      actionState = { type: 'swap', first: index };
      updateStatus("Swap: Select second cell");
      return false; 
    } else {
      const temp = board[actionState.first];
      board[actionState.first] = board[index];
      board[index] = temp;
      return true;
    }
  }

  if (card.name === 'Clone') {
    if (!actionState) {
      actionState = { type: 'clone_place', valueToClone: cell.value };
      updateStatus("Clone: Select empty cell to place clone");
      return false;
    } else {
      board[index] = { owner: turn, value: actionState.valueToClone, isShielded: false };
      return true;
    }
  }

  return true; 
}

function checkEndGame() {
  let winner = null;

  for (const combo of winCombos) {
    const firstCell = board[combo[0]];
    if (!firstCell) continue;

    const owner = firstCell.owner;
    const hasWinningLine = combo.every((index) => board[index] && board[index].owner === owner);

    if (hasWinningLine) {
      winner = owner;
      combo.forEach((index) => {
        if (boardEl.children[index]) {
          boardEl.children[index].style.border = '2px solid red';
        }
      });
      break;
    }
  }

  const isBoardFull = board.every(c => c !== null);
  const xCardsLeft = handX.length + deckX.length;
  const oCardsLeft = handO.length + deckO.length;
  const noCardsLeft = (xCardsLeft === 0 || oCardsLeft === 0);

  if (winner) {
    gameOver = true;
    updateStatus(`Player ${winner === 'X' ? '✕' : '◯'} Wins by Tic Tac Toe!`);
    return true;
  }

  if (isBoardFull || noCardsLeft) {
    gameOver = true;
    let scoreX = 0, scoreO = 0;
    board.forEach(c => {
      if (c) { if (c.owner === 'X') scoreX++; if (c.owner === 'O') scoreO++; }
    });
    
    if (scoreX > scoreO) updateStatus("Player ✕ Wins by Territory!");
    else if (scoreO > scoreX) updateStatus("Player ◯ Wins by Territory!");
    else updateStatus("It's a Draw!");
    return true;
  }

  return false;
}

function updateScores() {
  let sx = 0, so = 0;
  board.forEach(c => {
    if (c) { if (c.owner === 'X') sx++; if (c.owner === 'O') so++; }
  });
  scoreXEl.textContent = sx;
  scoreOEl.textContent = so;
}

function updateTurnIndicators() {
  if (gameOver) {
    sectionXEl.classList.remove('active');
    sectionOEl.classList.remove('active');
    return;
  }
  if (turn === 'X') {
    sectionXEl.classList.add('active');
    sectionOEl.classList.remove('active');
  } else {
    sectionOEl.classList.add('active');
    sectionXEl.classList.remove('active');
  }
}

function updateStatus(text) {
  statusEl.textContent = text;
}

// Boot the game
loadAndInit();
