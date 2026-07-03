// app.js - Complete Game Logic, PWA Flow, AI Bot, Undo, & UI Management

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const PLAYER_ICONS = ['👑', '🤖', '🃏', '🦊', '🤠', '🏴‍☠️', '🧙‍♂️', '🥷', '🦁', '🐉', '👾', '🎲'];

// --- Global Game State ---
let gameState = {
    deck: [],
    players: [],
    currentPlayerIndex: 0,
    board: {
        north: [], east: [], south: [], west: [],
        nw: [], ne: [], se: [], sw: []
    },
    gameStarted: false,
    isSinglePlayer: false,
    gameMode: 'casual',
    tournamentLimit: 100, // NEW: Defaults to 100
    undoEnabled: true,
    history: []
};

let activeDrag = null;

// --- Haptic Feedback Helper ---
function triggerHaptic(ms = 15) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

// --- 1. Initialize the Game ---
function initGame(playerNames, existingPlayers = null) {
    gameState.deck = createDeck();
    shuffle(gameState.deck);
    
    // If resuming/playing another round, keep existing score totals!
    if (existingPlayers) {
        gameState.players = existingPlayers.map(p => ({
            ...p,
            hand: [] // Clear hands for the new round
        }));
    } else {
        // Fresh game setup
        gameState.players = playerNames.map((name, idx) => ({ 
            name: name, 
            hand: [],
            score: 0, // NEW: Initialize cumulative score
            isAI: (gameState.isSinglePlayer && idx > 0)
        }));
    }
    
    gameState.currentPlayerIndex = 0;
    
    // Deal 7 cards to each player
    for (let i = 0; i < 7; i++) {
        gameState.players.forEach(player => {
            player.hand.push(gameState.deck.pop());
        });
    }
    
    // Reset board piles
    gameState.board = {
        north: [gameState.deck.pop()],
        east: [gameState.deck.pop()],
        south: [gameState.deck.pop()],
        west: [gameState.deck.pop()],
        nw: [], ne: [], se: [], sw: []
    };
    
    gameState.gameStarted = true;
    console.log("Round initialized! Players:", gameState.players);
}

// --- 2. Deck Helpers ---
function createDeck() {
    let deck = [];
    for (let suit of SUITS) {
        for (let value of VALUES) {
            let color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
            let rank = VALUES.indexOf(value) + 1; // A=1, J=11, Q=12, K=13
            deck.push({ suit, value, color, rank });
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// --- 3. Rule Validator ---
function isValidMove(card, targetPile) {
    if (targetPile.length === 0) {
        return card.value === 'K'; // Kings ONLY in empty corners
    }
    const topCard = targetPile[targetPile.length - 1];
    const isOppositeColor = card.color !== topCard.color;
    const isOneRankLower = topCard.rank - card.rank === 1;
    return isOppositeColor && isOneRankLower;
}

// --- 4. Initialize UI & Screens on Load ---
window.addEventListener('DOMContentLoaded', () => {
    setupGameScreen();
    setupTurnManagement();
    setupWinControls();
    
    // Bind Undo Button
    document.getElementById('undo-btn').addEventListener('click', performUndo);

    document.getElementById('quit-btn').addEventListener('click', () => {
    if (confirm("Are you sure you want to quit the current game?")) {
        // 1. Wipe the saved game from storage
        localStorage.removeItem('kingsCornerSave');
        
        // 2. Reset game state
        gameState.gameStarted = false;
        
        // 3. Hide game board and show setup screen
        document.getElementById('game-container').classList.add('hidden');
        document.getElementById('setup-screen').classList.remove('hidden');
    }
});

function setupThemeSwitcher() {
    const themeSelect = document.getElementById('theme-select');
    
    // Load saved theme if it exists, default to green-felt
    const savedTheme = localStorage.getItem('kingsCornerTheme') || 'green-felt';
    document.body.setAttribute('data-theme', savedTheme);
    themeSelect.value = savedTheme;

    // Listen for changes
    themeSelect.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        document.body.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('kingsCornerTheme', selectedTheme); // Save preference!
    });
}
    
    // Check for existing saved game
    loadGame();
});

function setupGameScreen() {
    const countSelect = document.getElementById('player-count');
    const container = document.getElementById('name-inputs-container');

    // NEW: Toggle Point Limit Dropdown visibility based on Game Mode selection
    const gameModeSelect = document.getElementById('game-mode');
    const limitGroup = document.getElementById('tournament-limit-group');

    if (gameModeSelect && limitGroup) {
        gameModeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'tournament') {
                limitGroup.classList.remove('hidden');
            } else {
                limitGroup.classList.add('hidden');
            }
        });
    }

    const renderInputFields = (count) => {
        container.innerHTML = '';
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'input-control player-name-input';
            input.placeholder = `Player ${i} Name`;
            input.value = `Player ${i}`;
            container.appendChild(input);
        }
    };

    if (countSelect && container) {
        renderInputFields(parseInt(countSelect.value));

        countSelect.addEventListener('change', (e) => {
            renderInputFields(parseInt(e.target.value));
        });

        document.getElementById('start-game-btn').addEventListener('click', () => {
            const nameInputs = document.querySelectorAll('.player-name-input');
            const playerNames = Array.from(nameInputs).map((input, index) => {
                return input.value.trim() || `Player ${index + 1}`;
            });
        
            // Read options from setup screen
            gameState.isSinglePlayer = (document.getElementById('player-count').value === '1');
            gameState.gameMode = document.getElementById('game-mode').value;
            
            // NEW: Parse the selected point limit as an integer
            gameState.tournamentLimit = parseInt(document.getElementById('tournament-limit').value, 10); 
            
            gameState.undoEnabled = document.getElementById('enable-undo').checked;
        
            initGame(playerNames);
        
            const undoBtn = document.getElementById('undo-btn');
            if (gameState.undoEnabled) undoBtn.classList.remove('hidden');
            else undoBtn.classList.add('hidden');
        
            renderBoard();
            document.getElementById('setup-screen').classList.add('hidden');
            showHoldScreen();
        });
    }
}

// --- 5. Turn Management & View Switching ---
function setupTurnManagement() {
    document.getElementById('start-turn-btn').addEventListener('click', () => {
        document.getElementById('hold-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        // Draw card at the start of turn
        if (gameState.deck.length > 0) {
            const drawnCard = gameState.deck.pop();
            gameState.players[gameState.currentPlayerIndex].hand.push(drawnCard);
        }
        
        renderBoard();
        renderHand();
        saveGame();
    });

    document.getElementById('end-turn-btn').addEventListener('click', () => {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        saveGame();
        showHoldScreen();
    });
}

function showHoldScreen() {
    const nextPlayer = gameState.players[gameState.currentPlayerIndex];

    // If it's a 1-Player game, skip the pass screen entirely for EVERYONE
    if (gameState.isSinglePlayer) {
        document.getElementById('hold-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        if (gameState.deck.length > 0) {
            nextPlayer.hand.push(gameState.deck.pop());
        }
            
        renderBoard();
        renderHand();
            
        if (nextPlayer.isAI) {
            checkAITurn();
        }
        return;
    }

    // Human-only turn handling (Multiplayer device passing)
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('hold-screen').classList.remove('hidden');
    document.getElementById('next-player-notice').textContent = `${nextPlayer.name}'s Turn`;
    document.getElementById('pass-device-notice').textContent = `Hand the device to ${nextPlayer.name}. Tap below when ready!`;
}

// --- 6. Win Screen & Round Rotation Controls ---
function setupWinControls() {
    document.getElementById('play-again-btn').addEventListener('click', () => {
        // Rotate player array so the next person gets to move first
        const previousFirstPlayer = gameState.players.shift();
        gameState.players.push(previousFirstPlayer);

        // If tournament finished (or casual mode), reset everyone's score to 0!
        if (gameState.isTournamentOver || gameState.gameMode !== 'tournament') {
            gameState.players.forEach(p => p.score = 0);
        }

        // Pass existing player objects into initGame
        initGame(null, gameState.players);
        renderBoard();
        
        document.getElementById('win-screen').classList.add('hidden');
        showHoldScreen();
    });

    document.getElementById('new-setup-btn').addEventListener('click', () => {
        document.getElementById('win-screen').classList.add('hidden');
        document.getElementById('setup-screen').classList.remove('hidden');
    });
}

// --- 6. Win Screen & Round Rotation Controls (Updated showWinScreen) ---
function showWinScreen(winnerName) {
    document.getElementById('game-container').classList.add('hidden');
    
    // Default heading for a single hand
    const winnerDisplay = document.getElementById('winner-display');
    winnerDisplay.textContent = `${winnerName} Wins the Hand!`;
    
    const scoreContainer = document.getElementById('round-scores');
    let html = `
        <table class="score-table">
            <thead>
                <tr>
                    <th>Player</th>
                    <th>Hand Penalty</th>
                    <th>Total Score</th>
                </tr>
            </thead>
            <tbody>`;
            
    // 1. Calculate and apply scores
    gameState.players.forEach(player => {
        const handPenalty = calculateHandScore(player.hand);
        player.score = (player.score || 0) + handPenalty;
        
        const isWinner = player.hand.length === 0;
        html += `
            <tr>
                <td>${player.name} ${isWinner ? '👑' : ''}</td>
                <td>${isWinner ? '--' : '+' + handPenalty}</td>
                <td><strong>${player.score} pts</strong></td>
            </tr>`;
    });
    html += `</tbody></table>`;
    
    // 2. Determine Button Text & Tournament Winner Logic
    const playAgainBtn = document.getElementById('play-again-btn');
    
    // NEW: Dynamically grab the point ceiling chosen on the setup screen!
    const TOURNAMENT_LIMIT = gameState.tournamentLimit || 100; 
    let isTournamentOver = false;

    if (gameState.gameMode === 'tournament') {
        // Check if anyone has reached or exceeded the limit
        const maxScore = Math.max(...gameState.players.map(p => p.score));
        
        if (maxScore >= TOURNAMENT_LIMIT) {
            isTournamentOver = true;
            // Find the player with the LOWEST score to crown Grand Champion
            const grandChamp = [...gameState.players].sort((a, b) => a.score - b.score)[0];
            winnerDisplay.innerHTML = `🏆 Tournament Complete! 🏆<br><span style="font-size: 1.2rem; color: var(--gold);">${grandChamp.name} is the Grand Champion!</span>`;
            playAgainBtn.textContent = "Start New Tournament 🏆";
            html += `<p style="font-size: 0.85rem; margin-top: 8px; color: #ffeb3b;">*Someone hit ${TOURNAMENT_LIMIT} points! Lowest total score wins the tournament!*</p>`;
        } else {
            playAgainBtn.textContent = "Deal Next Hand 🔀";
            html += `<p style="font-size: 0.8rem; margin-top: 8px; opacity: 0.8;">*Tournament Mode: Playing until someone reaches ${TOURNAMENT_LIMIT} points.*</p>`;
        }
    } else {
        // Casual Mode default
        playAgainBtn.textContent = "Play Again 🔄";
    }
    
    // Save state flag so win controls know whether to reset scores or not
    gameState.isTournamentOver = isTournamentOver;
    
    if (scoreContainer) scoreContainer.innerHTML = html;
    document.getElementById('win-screen').classList.remove('hidden');
    
    triggerHaptic([100, 50, 100, 50, 200]);
    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    
    localStorage.removeItem('kingsCornerSave');
}

// --- 7. Rendering Functions ---
function renderBoard() {
    document.getElementById('deck-count').textContent = gameState.deck.length;
    document.getElementById('current-player-display').textContent = gameState.players[gameState.currentPlayerIndex].name;

    for (const [pileKey, pileArray] of Object.entries(gameState.board)) {
        const pileEl = document.getElementById(`pile-${pileKey}`);
        const label = pileEl.querySelector('.pile-label');
        pileEl.innerHTML = '';
        if (label && pileArray.length === 0) pileEl.appendChild(label);

        pileArray.forEach((card, index) => {
            const cardEl = createCardElement(card);
            cardEl.style.top = `${index * 15}px`;
            
            // Only top card is draggable
            if (index === pileArray.length - 1) {
                makeDraggable(cardEl, { type: 'pile', pileKey: pileKey, cardIndex: index });
            }
            pileEl.appendChild(cardEl);
        });
    }
}

function renderHand() {
    const handEl = document.getElementById('player-hand');
    handEl.innerHTML = '';
    const currentHand = gameState.players[gameState.currentPlayerIndex].hand;

    currentHand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        makeDraggable(cardEl, { type: 'hand', cardIndex: index });
        handEl.appendChild(cardEl);
    });
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card ${card.color}`;
    el.innerHTML = `
        <div class="card-top-left">${card.value}<br>${card.suit}</div>
        <div class="card-center">${card.suit}</div>
        <div class="card-bottom-right">${card.value}<br>${card.suit}</div>
    `;
    return el;
}

// --- 8. Drag & Drop + Move Highlighting ---
function makeDraggable(element, dragData) {
    element.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        
        let cardObj;
        if (dragData.type === 'hand') {
            cardObj = gameState.players[gameState.currentPlayerIndex].hand[dragData.cardIndex];
        } else if (dragData.type === 'pile') {
            const pile = gameState.board[dragData.pileKey];
            cardObj = pile[pile.length - 1];
        }

        activeDrag = {
            element: element,
            data: dragData,
            card: cardObj,
            startX: e.clientX,
            startY: e.clientY
        };

        const ghost = document.getElementById('drag-ghost');
        ghost.className = `card ${cardObj.color}`;
        ghost.innerHTML = element.innerHTML;
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
        ghost.classList.remove('hidden');

        element.style.opacity = '0.3';
        
        // Highlight legal drop targets
        highlightValidMoves(cardObj, dragData.type);

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    });
}

function highlightValidMoves(cardObj, dragType) {
    for (const [pileKey, pileArray] of Object.entries(gameState.board)) {
        const pileEl = document.getElementById(`pile-${pileKey}`);
        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(pileKey);
        
        let isValid = false;
        if (pileArray.length === 0) {
            if (isCorner && cardObj.value === 'K') isValid = true;
            else if (!isCorner && dragType === 'hand') isValid = true;
        } else if (isValidMove(cardObj, pileArray)) {
            isValid = true;
        }

        if (isValid) pileEl.classList.add('valid-target');
    }
}

function clearHighlights() {
    document.querySelectorAll('.valid-target').forEach(el => {
        el.classList.remove('valid-target');
    });
}

function onPointerMove(e) {
    if (!activeDrag) return;
    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
}

function onPointerUp(e) {
    if (!activeDrag) return;
    
    clearHighlights();

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.getElementById('drag-ghost').classList.add('hidden');
    activeDrag.element.style.opacity = '1';

    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    const pileEl = dropTarget ? dropTarget.closest('.pile') : null;

    if (pileEl) {
        const targetPileKey = pileEl.dataset.pile;
        const targetPile = gameState.board[targetPileKey];
        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(targetPileKey);

        if (targetPile.length === 0 && isCorner && activeDrag.card.value !== 'K') {
            console.log("Only Kings can be placed in empty corner piles!");
        } 
        else if (targetPile.length === 0 && !isCorner && activeDrag.data.type === 'hand') {
            executeMove(targetPileKey);
        }
        else if (isValidMove(activeDrag.card, targetPile)) {
            executeMove(targetPileKey);
        }
    }

    activeDrag = null;
}

function executeMove(targetPileKey) {
    saveSnapshot(); // Capture state before mutating
    
    const targetPile = gameState.board[targetPileKey];

    if (activeDrag.data.type === 'hand') {
        const hand = gameState.players[gameState.currentPlayerIndex].hand;
        const [playedCard] = hand.splice(activeDrag.data.cardIndex, 1);
        targetPile.push(playedCard);
    } 
    else if (activeDrag.data.type === 'pile') {
        const sourcePileKey = activeDrag.data.pileKey;
        if (sourcePileKey !== targetPileKey) {
            const cardsToMove = gameState.board[sourcePileKey].splice(0);
            gameState.board[targetPileKey].push(...cardsToMove);
        }
    }

    triggerHaptic(15);

    if (gameState.players[gameState.currentPlayerIndex].hand.length === 0) {
        const winningPlayer = gameState.players[gameState.currentPlayerIndex];
        showWinScreen(winningPlayer.name);
        return;
    }

    renderBoard();
    renderHand();
    saveGame();
}

// --- 9. Auto-Save & LocalStorage ---
function saveGame() {
    if (!gameState.gameStarted) return;
    try {
        const stateToSave = { ...gameState, history: [] }; // Don't save history array to keep storage light
        localStorage.setItem('kingsCornerSave', JSON.stringify(stateToSave));
    } catch (e) { console.warn("Could not save game to localStorage", e); }
}

function loadGame() {
    const saved = localStorage.getItem('kingsCornerSave');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.gameStarted) {
                if (confirm("Resume saved game?")) {
                    gameState = parsed;
                    gameState.history = [];
                    document.getElementById('setup-screen').classList.add('hidden');
                    
                    const undoBtn = document.getElementById('undo-btn');
                    if (gameState.undoEnabled) undoBtn.classList.remove('hidden');
                    else undoBtn.classList.add('hidden');
                    
                    renderBoard();
                    renderHand();
                    checkAITurn();
                    return true;
                } else {
                    localStorage.removeItem('kingsCornerSave');
                }
            }
        } catch (e) { localStorage.removeItem('kingsCornerSave'); }
    }
    return false;
}

// --- 10. Undo System ---
function saveSnapshot() {
    if (!gameState.undoEnabled) return;
    const snapshot = JSON.parse(JSON.stringify({
        deck: gameState.deck,
        players: gameState.players,
        currentPlayerIndex: gameState.currentPlayerIndex,
        board: gameState.board
    }));
    gameState.history.push(snapshot);
    if (gameState.history.length > 15) gameState.history.shift(); // Max 15 undo steps
}

function performUndo() {
    if (gameState.history.length === 0) return;
    const previousState = gameState.history.pop();
    
    gameState.deck = previousState.deck;
    gameState.players = previousState.players;
    gameState.currentPlayerIndex = previousState.currentPlayerIndex;
    gameState.board = previousState.board;
    
    triggerHaptic(20);
    renderBoard();
    renderHand();
    saveGame();
}

// --- 11. Single-Player AI Bot Engine ---
function checkAITurn() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameState.isSinglePlayer || !currentPlayer.isAI) return;

    document.getElementById('current-player-display').textContent = `${currentPlayer.name} (Thinking...)`;
    document.getElementById('end-turn-btn').disabled = true;
    document.getElementById('undo-btn').disabled = true;

    setTimeout(() => {
        executeAIMoves();
    }, 800);
}

function executeAIMoves() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let madeMove = false;

    for (let i = 0; i < currentPlayer.hand.length; i++) {
        const card = currentPlayer.hand[i];
        
        for (const [pileKey, pileArray] of Object.entries(gameState.board)) {
            const isCorner = ['nw', 'ne', 'se', 'sw'].includes(pileKey);
            let legal = false;

            if (pileArray.length === 0) {
                if (isCorner && card.value === 'K') legal = true;
                else if (!isCorner) legal = true;
            } else if (isValidMove(card, pileArray)) {
                legal = true;
            }

            if (legal) {
                saveSnapshot();
                currentPlayer.hand.splice(i, 1);
                gameState.board[pileKey].push(card);
                triggerHaptic(10);
                renderBoard();
                renderHand();
                madeMove = true;
                break;
            }
        }
        if (madeMove) break; // One move per step for visual clarity
    }

    if (currentPlayer.hand.length === 0) {
        showWinScreen(currentPlayer.name);
        return;
    }

    if (madeMove) {
        setTimeout(executeAIMoves, 600); // Chain consecutive moves
    } else {
        setTimeout(() => {
            document.getElementById('end-turn-btn').disabled = false;
            document.getElementById('undo-btn').disabled = false;
            gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            saveGame();
            showHoldScreen();
        }, 500);
    }
}

// --- 12. Register PWA Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered!', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}

function calculateHandScore(hand) {
    return hand.reduce((total, card) => {
        if (['K', 'Q', 'J'].includes(card.value)) return total + 10;
        if (card.value === 'A') return total + 1;
        return total + parseInt(card.value, 10);
    }, 0);
}
