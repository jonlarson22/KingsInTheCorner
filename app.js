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
