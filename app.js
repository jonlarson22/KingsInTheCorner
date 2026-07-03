// app.js - Phase 1: Game State & Logic

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Global Game State
let gameState = {
    deck: [],
    players: [],
    currentPlayerIndex: 0,
    // 4 standard cross piles (N, E, S, W) and 4 corner piles (NW, NE, SE, SW)
    board: {
        north: [], east: [], south: [], west: [],
        nw: [], ne: [], se: [], sw: []
    },
    gameStarted: false
};

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
    console.log("Game initialized!", gameState);
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
        // (We will handle checking if the pile is a corner in the UI layer)
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

// 5. Initialize UI & Setup Screen on Load
window.addEventListener('DOMContentLoaded', () => {
    setupGameScreen();
    setupTurnManagement();
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

// 7. Rendering Functions
function renderBoard() {
    document.getElementById('deck-count').textContent = gameState.deck.length;
    document.getElementById('current-player-display').textContent = gameState.players[gameState.currentPlayerIndex].name;

    // Render all 8 piles
    for (const [pileKey, pileArray] of Object.entries(gameState.board)) {
        const pileEl = document.getElementById(`pile-${pileKey}`);
        // Clear existing rendered cards (keep corner label if empty)
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

// 8. Universal Touch/Mouse Drag & Drop Logic
function makeDraggable(element, dragData) {
    element.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        
        // Identify the exact card object being dragged
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

        // Setup Ghost Element for visual drag feedback
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

function onPointerMove(e) {
    if (!activeDrag) return;
    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
}

function onPointerUp(e) {
    if (!activeDrag) return;

    // Cleanup drag listeners & UI
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.getElementById('drag-ghost').classList.add('hidden');
    activeDrag.element.style.opacity = '1';

    // Identify drop target using collision detection
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    const pileEl = dropTarget ? dropTarget.closest('.pile') : null;

    if (pileEl) {
        const targetPileKey = pileEl.dataset.pile;
        const targetPile = gameState.board[targetPileKey];
        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(targetPileKey);

        // Enforce Corner Rule: Empty corners can ONLY take Kings
        if (targetPile.length === 0 && isCorner && activeDrag.card.value !== 'K') {
            console.log("Only Kings can be placed in empty corner piles!");
        } 
        // Enforce Standard Rule: Empty standard piles can take ANY card
        else if (targetPile.length === 0 && !isCorner && activeDrag.type === 'hand') {
            executeMove(targetPileKey);
        }
        // Enforce Rule Validator for occupied piles
        else if (isValidMove(activeDrag.card, targetPile)) {
            executeMove(targetPileKey);
        }
    }

    activeDrag = null;
}

function executeMove(targetPileKey) {
    const targetPile = gameState.board[targetPileKey];

    if (activeDrag.data.type === 'hand') {
        // Move card from hand to pile
        const hand = gameState.players[gameState.currentPlayerIndex].hand;
        const [playedCard] = hand.splice(activeDrag.data.cardIndex, 1);
        targetPile.push(playedCard);
    } 
    else if (activeDrag.data.type === 'pile') {
        // Merge piles: Move ALL cards from source pile to target pile
        const sourcePileKey = activeDrag.data.pileKey;
        if (sourcePileKey !== targetPileKey) {
            const cardsToMove = gameState.board[sourcePileKey].splice(0);
            gameState.board[targetPileKey].push(...cardsToMove);
        }
    }

    // Check for Win Condition
    if (gameState.players[gameState.currentPlayerIndex].hand.length === 0) {
        alert(`${gameState.players[gameState.currentPlayerIndex].name} Wins!`);
        location.reload();
        return;
    }

    renderBoard();
    renderHand();
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered!', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}
