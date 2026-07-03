// app.js - Complete Game Logic, PWA Flow, & UI Management

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Add to your Global Game State
let gameState = {
    deck: [],
    players: [],
    currentPlayerIndex: 0,
    board: {
        north: [], east: [], south: [], west: [],
        nw: [], ne: [], se: [], sw: []
    },
    gameStarted: false,
    // NEW: Feature tracking
    isSinglePlayer: false,
    undoEnabled: true,
    history: [] // Stores state snapshots for Undo
};

// Haptic Feedback Helper
function triggerHaptic(ms = 15) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

// 1. Initialize the Game
function initGame(playerNames) {
    gameState.deck = createDeck();
    shuffle(gameState.deck);
    
    // Set up players with empty hands
    gameState.players = playerNames.map(name => ({ name: name, hand: [] }));
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
    console.log("Game initialized with turn order:", gameState.players.map(p => p.name));
}

// 2. Helper: Create a Standard 52-Card Deck
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

// 3. Helper: Shuffle Deck (Fisher-Yates Algorithm)
function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// 4. Rule Validator: Can Card A be placed on Pile B?
function isValidMove(card, targetPile) {
    // If the pile is empty
    if (targetPile.length === 0) {
        // Kings can ONLY go into empty corners (NW, NE, SE, SW)
        return card.value === 'K';
    }
    
    const topCard = targetPile[targetPile.length - 1];
    
    // Valid move: Must be opposite color AND exactly one rank lower
    const isOppositeColor = card.color !== topCard.color;
    const isOneRankLower = topCard.rank - card.rank === 1;
    
    return isOppositeColor && isOneRankLower;
}

// --- Phase 3 & 4: UI Rendering, Turn Management, & Drag/Drop ---

let activeDrag = null;

// 5. Initialize UI & Screens on Load
window.addEventListener('DOMContentLoaded', () => {
    setupGameScreen();
    setupTurnManagement();
    setupWinControls();
});

function setupGameScreen() {
    const countSelect = document.getElementById('player-count');
    const container = document.getElementById('name-inputs-container');

    // Helper to generate text boxes based on selected count
    const renderInputFields = (count) => {
        container.innerHTML = '';
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'input-control player-name-input';
            input.placeholder = `Player ${i} Name`;
            input.value = `Player ${i}`; // Default value
            container.appendChild(input);
        }
    };

    // Initial render for 2 players
    if (countSelect && container) {
        renderInputFields(parseInt(countSelect.value));

        // Listen for dropdown changes
        countSelect.addEventListener('change', (e) => {
            renderInputFields(parseInt(e.target.value));
        });

        // Start Game Button Click
        document.getElementById('start-game-btn').addEventListener('click', () => {
            const nameInputs = document.querySelectorAll('.player-name-input');
            const playerNames = Array.from(nameInputs).map((input, index) => {
                // Fallback to "Player X" if they left the field blank
                return input.value.trim() || `Player ${index + 1}`;
            });

            initGame(playerNames);
            renderBoard();
            
            // Hide setup, show the first player's hold screen
            document.getElementById('setup-screen').classList.add('hidden');
            showHoldScreen();
        });
    }
}

// 6. View Switching & Turn Management
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
    });

    document.getElementById('end-turn-btn').addEventListener('click', () => {
        // Switch to next player index
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        showHoldScreen();
    });
}

function showHoldScreen() {
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('hold-screen').classList.remove('hidden');
    
    // Grab the specific name of the player whose turn is starting
    const nextPlayerName = gameState.players[gameState.currentPlayerIndex].name;
    
    // Inject personalized names into the hold screen
    document.getElementById('next-player-notice').textContent = `${nextPlayerName}'s Turn`;
    document.getElementById('pass-device-notice').textContent = `Hand the device to ${nextPlayerName}. Tap below when ready!`;
}

// 7. Win Screen & Round Rotation Controls
function setupWinControls() {
    // Play again with the same players, but ROTATE starting order for fairness!
    document.getElementById('play-again-btn').addEventListener('click', () => {
        let currentNames = gameState.players.map(p => p.name);
        
        // Rotate: Move the person who went first this round to the end of the line
        const previousFirstPlayer = currentNames.shift();
        currentNames.push(previousFirstPlayer);

        initGame(currentNames);
        renderBoard();
        
        document.getElementById('win-screen').classList.add('hidden');
        showHoldScreen();
    });

    // Go back to the main setup screen
    document.getElementById('new-setup-btn').addEventListener('click', () => {
        document.getElementById('win-screen').classList.add('hidden');
        document.getElementById('setup-screen').classList.remove('hidden');
    });
}

function showWinScreen(winnerName) {
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('winner-display').textContent = `${winnerName} Wins!`;
    document.getElementById('win-screen').classList.remove('hidden');
    
    // Trigger Haptic pulse
    triggerHaptic([100, 50, 100, 50, 200]);

    // Fire Confetti!
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
    
    localStorage.removeItem('kingsCornerSave'); // Clear save on game over
}

// 8. Rendering Functions
function renderBoard() {
    document.getElementById('deck-count').textContent = gameState.deck.length;
    document.getElementById('current-player-display').textContent = gameState.players[gameState.currentPlayerIndex].name;

    // Render all 8 piles
    for (const [pileKey, pileArray] of Object.entries(gameState.board)) {
        const pileEl = document.getElementById(`pile-${pileKey}`);
        const label = pileEl.querySelector('.pile-label');
        pileEl.innerHTML = '';
        if (label && pileArray.length === 0) pileEl.appendChild(label);

        // Render overlapping cards in the pile
        pileArray.forEach((card, index) => {
            const cardEl = createCardElement(card);
            cardEl.style.top = `${index * 15}px`; // Vertical offset for stacking
            
            // Only the top card of a pile can be dragged (for pile merging)
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

// 9. Universal Touch/Mouse Drag & Drop Logic
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

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    });
}

// Add inside makeDraggable() right after setting activeDrag:
function highlightValidMoves(cardObj, dragType) {
    for (const [pileKey, pileArray] of Object.entries(gameState.board)) {
        const pileEl = document.getElementById(`pile-${pileKey}`);
        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(pileKey);
        
        let isValid = false;
        if (pileArray.length === 0) {
            // Empty corners take Kings; empty standards take ANY hand card
            if (isCorner && cardObj.value === 'K') isValid = true;
            else if (!isCorner && dragType === 'hand') isValid = true;
        } else if (isValidMove(cardObj, pileArray)) {
            isValid = true;
        }

        if (isValid) pileEl.classList.add('valid-target');
    }
}

// Helper to clear highlights on drop
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
        else if (targetPile.length === 0 && !isCorner && activeDrag.type === 'hand') {
            executeMove(targetPileKey);
        }
        else if (isValidMove(activeDrag.card, targetPile)) {
            executeMove(targetPileKey);
        }
    }

    activeDrag = null;
}

function executeMove(targetPileKey) {
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

    // Check for Win Condition -> Transition to Win Screen!
    if (gameState.players[gameState.currentPlayerIndex].hand.length === 0) {
        const winningPlayer = gameState.players[gameState.currentPlayerIndex];
        showWinScreen(winningPlayer.name);
        return;
    }

    renderBoard();
    renderHand();
}

// 10. Register PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered!', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}

// --- Auto-Save & LocalStorage ---
function saveGame() {
    if (!gameState.gameStarted) return;
    try {
        // We don't save the history stack to keep localStorage lightweight
        const stateToSave = { ...gameState, history: [] };
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
                    gameState.history = []; // Reset undo stack on reload
                    document.getElementById('setup-screen').classList.add('hidden');
                    if (gameState.undoEnabled) {
                        document.getElementById('undo-btn').classList.remove('hidden');
                    }
                    renderBoard();
                    renderHand();
                    
                    // If resuming into AI turn, trigger it
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

// --- Undo System ---
function saveSnapshot() {
    if (!gameState.undoEnabled) return;
    // Deep copy current state without the history array itself
    const snapshot = JSON.parse(JSON.stringify({
        deck: gameState.deck,
        players: gameState.players,
        currentPlayerIndex: gameState.currentPlayerIndex,
        board: gameState.board
    }));
    gameState.history.push(snapshot);
    // Limit history to last 15 moves to prevent memory bloat
    if (gameState.history.length > 15) gameState.history.shift();
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

function checkAITurn() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameState.isSinglePlayer || !currentPlayer.isAI) return;

    // Show AI status on header
    document.getElementById('current-player-display').textContent = `${currentPlayer.name} (Thinking...)`;
    document.getElementById('end-turn-btn').disabled = true;

    setTimeout(() => {
        executeAIMoves();
    }, 800);
}

function executeAIMoves() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let madeMove = false;

    // 1. Try to play cards from hand
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
        if (madeMove) break; // Execute one move at a time for visual clarity
    }

    // 2. Check Win Condition
    if (currentPlayer.hand.length === 0) {
        showWinScreen(currentPlayer.name);
        return;
    }

    // 3. If a move was made, pause and check for chain moves!
    if (madeMove) {
        setTimeout(executeAIMoves, 600);
    } else {
        // No valid moves left -> End AI Turn
        setTimeout(() => {
            document.getElementById('end-turn-btn').disabled = false;
            gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            saveGame();
            showHoldScreen();
        }, 500);
    }
}
