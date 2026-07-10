const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const PLAYER_ICONS = ['😀', '😇', '🥰', '🤪', '🤩', '😎', '🤯', '🤖', '🐧', '🦦', '🦥', '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐵', '🦩', '🐊', '🦈', '🐬', '🐟', '🦀', '🐙', '🐢', '🐍', '🦖', '🦕', '🐝', '🦋', '🕷️', '🦚', '🦜', '🐉', '🩰', '🧜‍♀️', '🧙‍♂️', '🎅', '🥷', '🧑‍🚀', '🤴', '👸', '🧌', '🤠', '🤡', '👻', '💀', '👽', '🎃', '🧠', '🌹', '🍀', '🌴', '🌵', '🎄', '🌎', '☀️', '⭐', '🌪️', '🔥', '⚡️', '🏴‍☠️', '🎲', '🔮', '💎', '💰', '💣', '🧬', '☢️', '☣️', '🔱', '⚜️', '🩷', '❤️', '💜', '⛄', '🧸', '🎠', '✈️', '🚀', '⛵', '⛺', '🩰', '🤿', '🏒', '⛷️', '🏀', '⚽', '🏐', '🎾', '🍎', '🍊', '🍉', '🍓', '🍍', '🧀', '🥨', '🥞', '🍔', '🌭', '🍕', '🍿', '🍭', '🍦', '🍩'];

const SoundManager = {
    enabled: true,
    context: null,
    buffers: {},
    soundUrls: {
        draw: './sounds/draw.mp3',
        validDrop: './sounds/drop-valid.mp3',
        invalidDrop: './sounds/drop-invalid.mp3',
        turn: './sounds/turn-notify.mp3',
        roundWin: './sounds/win-round.mp3',
        tournamentWin: './sounds/win-tournament.mp3'
    },

    init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();

        for (const [name, url] of Object.entries(this.soundUrls)) {
            fetch(url)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.context.decodeAudioData(arrayBuffer))
                .then(audioBuffer => {
                    this.buffers[name] = audioBuffer;
                })
                .catch(e => console.warn(`Error loading sound ${name}:`, e));
        }
    },

    play(effectName) {
        if (!this.enabled || !this.context || !this.buffers[effectName]) return;

        try {
            if (this.context.state === 'suspended') {
                this.context.resume();
            }

            const source = this.context.createBufferSource();
            source.buffer = this.buffers[effectName];
            source.connect(this.context.destination);
            source.start(0);
        } catch (e) { 
            console.warn("Audio engine error:", e); 
        }
    }
};

let gameState = {
    deck: [],
    players: [],
    currentPlayerIndex: 0,
    board: {
        north: [], east: [], south: [], west: [],
        nw: [], ne: [], se: [], sw: []
    },
    gameStarted: false,
    gameMode: 'casual',
    tournamentLimit: 100,
    undoEnabled: true,
    hasDrawnThisTurn: false,
    history: []
};

let activeDrag = null;
let isBotTurn = false;

function triggerHaptic(ms = 15) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(ms); } catch (e) {}
    }
}

function initGame(playersData, existingPlayers = null) {
    gameState.deck = createDeck();
    shuffle(gameState.deck);
    
    if (existingPlayers) {
        gameState.players = existingPlayers.map(p => ({
            ...p,
            hand: [] 
        }));
    } else {
        gameState.players = playersData.map((data, idx) => ({ 
            name: data.name, 
            icon: data.icon || '👤', 
            hand: [],
            score: 0,
            isAI: data.isAI
        }));
    }
    
    gameState.currentPlayerIndex = 0;
    gameState.hasDrawnThisTurn = false;
    
    for (let i = 0; i < 7; i++) {
        gameState.players.forEach(player => {
            player.hand.push(gameState.deck.pop());
        });
    }
    
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

function createDeck() {
    let deck = [];
    for (let suit of SUITS) {
        for (let value of VALUES) {
            let color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
            let rank = VALUES.indexOf(value) + 1;
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

function isValidMove(card, targetPile) {
    if (targetPile.length === 0) {
        return card.value === 'K'; 
    }
    const topCard = targetPile[targetPile.length - 1];
    const isOppositeColor = card.color !== topCard.color;
    const isOneRankLower = topCard.rank - card.rank === 1;
    return isOppositeColor && isOneRankLower;
}

window.addEventListener('DOMContentLoaded', () => {
    SoundManager.init();
    setupGameScreen();
    setupTurnManagement();
    setupWinControls();
    
    document.getElementById('undo-btn').addEventListener('click', performUndo);

    document.getElementById('quit-btn').addEventListener('click', () => {
        if (confirm("Are you sure you want to quit the current game?")) {
            localStorage.removeItem('kingsCornerSave');
            gameState.gameStarted = false;
            document.getElementById('game-container').classList.add('hidden');
            document.getElementById('setup-screen').classList.remove('hidden');
        }
    });

    function setupThemeSwitcher() {
        const themeSelect = document.getElementById('theme-select');
        const savedTheme = localStorage.getItem('kingsCornerTheme') || 'green-felt';
        document.body.setAttribute('data-theme', savedTheme);
        themeSelect.value = savedTheme;

        themeSelect.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            document.body.setAttribute('data-theme', selectedTheme);
            localStorage.setItem('kingsCornerTheme', selectedTheme);
        });
    }
    
    setupThemeSwitcher();
    loadGame();
});

function setupGameScreen() {
    const countSelect = document.getElementById('player-count');
    const container = document.getElementById('name-inputs-container');
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
            const row = document.createElement('div');
            row.className = 'player-input-row';
            row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
            
            const select = document.createElement('select');
            select.className = 'input-control player-icon-select';
            select.style.cssText = 'width: 65px; font-size: 1.2rem; text-align: center; cursor: pointer;';
            
            PLAYER_ICONS.forEach((icon, idx) => {
                const opt = document.createElement('option');
                opt.value = icon;
                opt.textContent = icon;
                if (idx === (i - 1) % PLAYER_ICONS.length) opt.selected = true;
                select.appendChild(opt);
            });

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'input-control player-name-input';
            input.style.flex = '1';
            input.placeholder = `Player ${i} Name`;
            input.value = i === 1 ? 'Player 1' : `Bot ${i - 1}`;

            const typeSelect = document.createElement('select');
            typeSelect.className = 'input-control player-type-select';
            typeSelect.style.cssText = 'width: 100px; cursor: pointer; font-weight: bold;';
            typeSelect.innerHTML = `
                <option value="human">Human</option>
                <option value="ai">Bot 🤖</option>
            `;

            if (i > 1) {
                typeSelect.value = 'ai';
                select.value = '🤖';
            }

            typeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'ai') {
                    select.value = '🤖';
                    if (input.value.startsWith('Player')) {
                        input.value = `Bot ${i - 1}`;
                    }
                } else {
                    select.value = PLAYER_ICONS[(i - 1) % PLAYER_ICONS.length];
                    if (input.value.startsWith('Bot')) {
                        input.value = `Player ${i}`;
                    }
                }
            });
            
            row.appendChild(select);
            row.appendChild(input);
            row.appendChild(typeSelect);
            container.appendChild(row);
        }
    };

    if (countSelect && container) {
        renderInputFields(parseInt(countSelect.value));

        countSelect.addEventListener('change', (e) => {
            renderInputFields(parseInt(e.target.value));
        });

        document.getElementById('start-game-btn').addEventListener('click', () => {
            const rows = container.querySelectorAll('.player-input-row');
            
            const playersData = Array.from(rows).map((row, index) => {
                const name = row.querySelector('.player-name-input').value.trim() || `Player ${index + 1}`;
                const icon = row.querySelector('.player-icon-select').value;
                const isAI = row.querySelector('.player-type-select').value === 'ai';
                return { name, icon, isAI };
            });
        
            gameState.gameMode = document.getElementById('game-mode').value;
            gameState.tournamentLimit = parseInt(document.getElementById('tournament-limit').value, 10); 
            gameState.undoEnabled = document.getElementById('enable-undo').checked;
            
            initGame(playersData);
        
            const undoBtn = document.getElementById('undo-btn');
            if (gameState.undoEnabled) undoBtn.classList.remove('hidden');
            else undoBtn.classList.add('hidden');
        
            renderBoard();
            document.getElementById('setup-screen').classList.add('hidden');
            showHoldScreen();
        });
    }
}

function setupTurnManagement() {
    document.getElementById('start-turn-btn').addEventListener('click', () => {
        document.getElementById('hold-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        
        startPlayerTurnUI();
    });

    document.getElementById('end-turn-btn').addEventListener('click', () => {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        gameState.hasDrawnThisTurn = false; 
        saveGame();
        showHoldScreen();
    });

    document.getElementById('center-deck').addEventListener('click', () => {
        if (isBotTurn) return;
        
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (gameState.hasDrawnThisTurn || gameState.deck.length === 0 || currentPlayer.isAI) {
            return;
        }
        executeInteractiveDraw();
    });
}
function startPlayerTurnUI() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const deckEl = document.getElementById('center-deck');
    const endTurnBtn = document.getElementById('end-turn-btn');

    if (gameState.deck.length === 0 || currentPlayer.isAI) {
        gameState.hasDrawnThisTurn = true;
        deckEl.classList.remove('can-draw');
        endTurnBtn.disabled = false;
    } else if (!gameState.hasDrawnThisTurn) {
        deckEl.classList.add('can-draw');
        endTurnBtn.disabled = true; 
    } else {
        deckEl.classList.remove('can-draw');
        endTurnBtn.disabled = false;
    }

    renderBoard();
    renderHand();
    saveGame();
}

function executeInteractiveDraw() {
    if (gameState.deck.length === 0) return;

    gameState.hasDrawnThisTurn = true;
    const deckEl = document.getElementById('center-deck');
    const endTurnBtn = document.getElementById('end-turn-btn');

    deckEl.classList.remove('can-draw');
    endTurnBtn.disabled = false;

    const drawnCard = gameState.deck.pop();
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    const deckRect = deckEl.getBoundingClientRect();
    const handRect = document.getElementById('player-hand').getBoundingClientRect();

    const ghost = createCardElement(drawnCard);
    ghost.classList.add('card-flying');
    ghost.style.left = `${deckRect.left}px`;
    ghost.style.top = `${deckRect.top}px`;
    document.body.appendChild(ghost);

    SoundManager.play('draw');
    triggerHaptic(20);

    ghost.getBoundingClientRect();

    const targetX = handRect.left + (handRect.width / 2) - 35;
    const targetY = handRect.top + 10;
    ghost.style.left = `${targetX}px`;
    ghost.style.top = `${targetY}px`;
    ghost.style.transform = 'scale(1.05) rotate(360deg)';

    setTimeout(() => {
        if (ghost && ghost.parentNode) {
            ghost.parentNode.removeChild(ghost);
        }
        currentPlayer.hand.push(drawnCard);
        renderBoard();
        renderHand();
        saveGame();
    }, 350);
}

function showHoldScreen() {
    document.querySelectorAll('.card-flying').forEach(el => el.remove());
    activeDrag = null;

    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    const previousPlayerIndex = (gameState.currentPlayerIndex - 1 + gameState.players.length) % gameState.players.length;
    const previousPlayer = gameState.players[previousPlayerIndex];
    const humanPlayers = gameState.players.filter(p => !p.isAI);

    const readyBtn = document.getElementById('start-turn-btn');
    if (readyBtn) readyBtn.textContent = "READY!";

    if (nextPlayer.isAI) {
        document.getElementById('hold-screen').classList.add('hidden');
        document.getElementById('game-container').classList.remove('hidden');
        checkAITurn();
        return;
    }

    if (previousPlayer.isAI || humanPlayers.length === 1) {
        SoundManager.play('turn');
        triggerHaptic([50, 50]);
        
        if (humanPlayers.length === 1) {
            document.getElementById('hold-screen').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            startPlayerTurnUI();
            return;
        }
    }

    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('hold-screen').classList.remove('hidden');
    
    const noticeEl = document.getElementById('next-player-notice');
    noticeEl.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 10px; line-height: 1;">${nextPlayer.icon}</div>
        <div>${nextPlayer.name}'s Turn</div>
    `;
    
    document.getElementById('pass-device-notice').textContent = `Hand the device to ${nextPlayer.name}.`;
    
    if (!previousPlayer.isAI && humanPlayers.length > 1) {
        SoundManager.play('turn');
    }
}

function setupWinControls() {
    document.getElementById('play-again-btn').addEventListener('click', () => {
        const previousFirstPlayer = gameState.players.shift();
        gameState.players.push(previousFirstPlayer);

        if (gameState.isTournamentOver || gameState.gameMode !== 'tournament') {
            gameState.players.forEach(p => p.score = 0);
        }

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

function showWinScreen(winnerName) {
    document.getElementById('game-container').classList.add('hidden');
    
    const winnerDisplay = document.getElementById('winner-display');
    const winningPlayerObj = gameState.players.find(p => p.name === winnerName);
    const winnerIcon = winningPlayerObj ? winningPlayerObj.icon : '👑';
    
    winnerDisplay.innerHTML = `<span style="font-size: 2.5rem;">${winnerIcon}</span><br>${winnerName} Wins the Hand!`;
    
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
            
    gameState.players.forEach(player => {
        const handPenalty = calculateHandScore(player.hand);
        player.score = (player.score || 0) + handPenalty;
        
        const isWinner = player.hand.length === 0;
        html += `
            <tr>
                <td><span style="font-size: 1.2rem; margin-right: 6px;">${player.icon}</span><strong>${player.name}</strong> ${isWinner ? '👑' : ''}</td>
                <td>${isWinner ? '--' : '+' + handPenalty}</td>
                <td><strong>${player.score} pts</strong></td>
            </tr>`;
    });
    html += `</tbody></table>`;
    
    const playAgainBtn = document.getElementById('play-again-btn');
    const TOURNAMENT_LIMIT = gameState.tournamentLimit || 100; 
    let isTournamentOver = false;

    if (gameState.gameMode === 'tournament') {
        const maxScore = Math.max(...gameState.players.map(p => p.score));
        
        if (maxScore >= TOURNAMENT_LIMIT) {
            isTournamentOver = true;
            const grandChamp = [...gameState.players].sort((a, b) => a.score - b.score)[0];
            winnerDisplay.innerHTML = `🏆 Tournament Complete! 🏆<br><div style="font-size: 3rem; margin: 10px 0;">${grandChamp.icon}</div><span style="font-size: 1.4rem; color: var(--gold);">${grandChamp.name} is the Grand Champion!</span>`;
            playAgainBtn.textContent = "Start New Tournament 🏆";
            html += `<p style="font-size: 0.85rem; margin-top: 8px; color: #ffeb3b;">*Someone hit ${TOURNAMENT_LIMIT} points! Lowest total score wins the tournament!*</p>`;
            
            SoundManager.play('tournamentWin');
        } else {
            playAgainBtn.textContent = "Deal Next Hand 🔀";
            html += `<p style="font-size: 0.8rem; margin-top: 8px; opacity: 0.8;">*Tournament Mode: Playing until someone reaches ${TOURNAMENT_LIMIT} points.*</p>`;
            
            SoundManager.play('roundWin');
        }
    } else {
        playAgainBtn.textContent = "Play Again 🔄";
        SoundManager.play('roundWin');
    }
    
    gameState.isTournamentOver = isTournamentOver;
    
    if (scoreContainer) scoreContainer.innerHTML = html;
    document.getElementById('win-screen').classList.remove('hidden');
    
    triggerHaptic([100, 50, 100, 50, 200]);
    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    
    localStorage.removeItem('kingsCornerSave');
}

/**
 * Renders a stack of cards with dynamic vertical compression to prevent UI overflow.
 * @param {HTMLElement} container - The DOM element representing the pile.
 * @param {Array} cardArray - Array of card objects in this pile.
 * @param {String} pileKey - The dictionary key for the pile (e.g., 'north', 'nw').
 */

function renderCardStack(container, cardArray, pileKey) {
    const label = container.querySelector('.pile-label');
    container.innerHTML = '';
    if (label && cardArray.length === 0) {
        container.appendChild(label);
        return;
    }

    const isMobile = window.innerWidth <= 768;

    const baseDrop = isMobile ? 15 : 26; 
    const stackStep = isMobile ? 1 : 2;

    let maxOffset = 0;
    if (cardArray.length > 1) {
        maxOffset = baseDrop + ((cardArray.length - 2) * stackStep);
    }

    cardArray.forEach((card, index) => {
        const cardEl = createCardElement(card);

        let verticalOffset = 0;
        if (index > 0) {
            verticalOffset = baseDrop + ((index - 1) * stackStep);
        }

        cardEl.style.top = `calc(50% - (var(--card-height) / 2) - (${maxOffset}px / 2) + ${verticalOffset}px)`;
        cardEl.style.left = `calc(50% - (var(--card-width) / 2))`;
        cardEl.style.zIndex = index + 1;

        makeDraggable(cardEl, { type: 'pile', pileKey: pileKey, cardIndex: index });
        
        container.appendChild(cardEl);
    });
}

function renderBoard() {
    document.getElementById('deck-count').textContent = gameState.deck.length;
    
    const currentP = gameState.players[gameState.currentPlayerIndex];
    document.getElementById('current-player-display').textContent = `${currentP.icon} ${currentP.name}`;

    for (const [pileKey, pileArray] of Object.entries(gameState.board)) {
        const pileEl = document.getElementById(`pile-${pileKey}`);
        if (pileEl) {
            renderCardStack(pileEl, pileArray, pileKey);
        }
    }
}

function renderHand() {
    const handEl = document.getElementById('player-hand');
    handEl.innerHTML = '';
    const currentPlayerObj = gameState.players[gameState.currentPlayerIndex];
    const currentHand = currentPlayerObj.hand;

    if (currentPlayerObj.isAI) {
        currentHand.forEach(() => {
            const cardBack = document.createElement('div');
            cardBack.className = 'card card-back';
            cardBack.style.pointerEvents = 'none'; 
            handEl.appendChild(cardBack);
        });
        return;
    }

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

function makeDraggable(element, dragData) {
    element.addEventListener('pointerdown', (e) => {
        if (isBotTurn) return;

        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (!gameState.hasDrawnThisTurn && !currentPlayer.isAI && gameState.deck.length > 0) {
            const deckEl = document.getElementById('center-deck');
            deckEl.style.transform = 'scale(1.15)';
            setTimeout(() => deckEl.style.transform = '', 150);
            SoundManager.play('invalidDrop');
            triggerHaptic([30, 30]);
            return;
        }

        e.preventDefault();

        let cardObj;
        let visualCard;

        if (dragData.type === 'hand') {
            cardObj = gameState.players[gameState.currentPlayerIndex].hand[dragData.cardIndex];
            visualCard = cardObj;
        } else if (dragData.type === 'pile') {
            const pile = gameState.board[dragData.pileKey];
            cardObj = pile[0]; 
            visualCard = pile[dragData.cardIndex]; 
        }

        activeDrag = {
            element: element,
            data: dragData,
            card: cardObj,
            startX: e.clientX,
            startY: e.clientY
        };

        const ghost = document.getElementById('drag-ghost');

        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
        ghost.className = `card ${visualCard.color} dragging`;
        ghost.innerHTML = element.innerHTML;

        element.style.opacity = '0.3';
        
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
    let moveSuccessful = false;

    if (pileEl && pileEl.dataset.pile) {
    const targetPileKey = pileEl.dataset.pile;
    if (activeDrag.data.type === 'pile' && activeDrag.data.pileKey === targetPileKey) {
        return;
    }
    const targetPile = gameState.board[targetPileKey];
    const isCorner = ['nw', 'ne', 'se', 'sw'].includes(targetPileKey);

    if (targetPile.length === 0 && isCorner && activeDrag.card.value !== 'K') {
        console.log("Only Kings can be placed in empty corner piles!");
    } 
    else if (targetPile.length === 0 && !isCorner) {
        executeMove(targetPileKey);
        moveSuccessful = true;
    }
    else if (isValidMove(activeDrag.card, targetPile)) {
        executeMove(targetPileKey);
        moveSuccessful = true;
    }
}

    if (!moveSuccessful && pileEl) {
        SoundManager.play('invalidDrop');
        triggerHaptic([30, 30, 30]); 
    }

    activeDrag = null;
}

function executeMove(targetPileKey) {
    saveSnapshot(); 
    
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

    SoundManager.play('validDrop'); 
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

function saveGame() {
    if (!gameState.gameStarted) return;
    try {
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
                    gameState.history = [];
                    document.getElementById('setup-screen').classList.add('hidden');
                    
                    const undoBtn = document.getElementById('undo-btn');
                    if (gameState.undoEnabled) undoBtn.classList.remove('hidden');
                    else undoBtn.classList.add('hidden');
                    
                    showHoldScreen();
                    return true;
                } else {
                    localStorage.removeItem('kingsCornerSave');
                }
            }
        } catch (e) { localStorage.removeItem('kingsCornerSave'); }
    }
    return false;
}

function saveSnapshot() {
    if (!gameState.undoEnabled) return;
    const snapshot = JSON.parse(JSON.stringify({
        deck: gameState.deck,
        players: gameState.players,
        currentPlayerIndex: gameState.currentPlayerIndex,
        board: gameState.board,
        hasDrawnThisTurn: gameState.hasDrawnThisTurn
    }));
    gameState.history.push(snapshot);
    if (gameState.history.length > 15) gameState.history.shift(); 
}

function performUndo() {
    if (gameState.history.length === 0) return;
    
    document.querySelectorAll('.card-flying').forEach(el => el.remove());
    activeDrag = null;
    
    const previousState = gameState.history.pop();
    
    gameState.deck = previousState.deck;
    gameState.players = previousState.players;
    gameState.currentPlayerIndex = previousState.currentPlayerIndex;
    gameState.board = previousState.board;
    gameState.hasDrawnThisTurn = previousState.hasDrawnThisTurn !== undefined ? previousState.hasDrawnThisTurn : true;
    
    SoundManager.play('draw'); 
    triggerHaptic(20);
    startPlayerTurnUI(); 
}

function checkAITurn() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isAI) return;

    isBotTurn = true;
    document.getElementById('game-container').classList.add('board-locked');

    gameState.hasDrawnThisTurn = true;
    document.getElementById('center-deck').classList.remove('can-draw');
    document.getElementById('current-player-display').textContent = `${currentPlayer.icon || '🤖'} ${currentPlayer.name}`;
    
    if (gameState.deck.length > 0) {
        currentPlayer.hand.push(gameState.deck.pop());
    }

    document.getElementById('end-turn-btn').disabled = true;
    document.getElementById('undo-btn').disabled = true;

    setTimeout(() => {
        executeAIMoves();
    }, 1500);
}

function executeAIMoves() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    let madeMove = false;

    for (const [sourceKey, sourcePile] of Object.entries(gameState.board)) {
        if (sourcePile.length === 0) continue;
        const bottomCard = sourcePile[0];

        for (const [targetKey, targetPile] of Object.entries(gameState.board)) {
            if (sourceKey === targetKey) continue;
            const isCorner = ['nw', 'ne', 'se', 'sw'].includes(targetKey);

            let canMovePile = false;
            if (targetPile.length === 0) {
                if (isCorner && bottomCard.value === 'K' && !['nw', 'ne', 'se', 'sw'].includes(sourceKey)) {
                    canMovePile = true;
                }
            } else if (isValidMove(bottomCard, targetPile)) {
                canMovePile = true;
            }

            if (canMovePile) {
                saveSnapshot();
                const cardsToMove = gameState.board[sourceKey].splice(0);
                gameState.board[targetKey].push(...cardsToMove);
                
                SoundManager.play('validDrop'); 
                triggerHaptic(10);
                renderBoard();
                madeMove = true;
                break;
            }
        }
        if (madeMove) break;
    }

    if (!madeMove) {
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
                    
                    SoundManager.play('validDrop'); 
                    triggerHaptic(10);
                    renderBoard();
                    renderHand();
                    madeMove = true;
                    break;
                }
            }
            if (madeMove) break; 
        }
    }

    if (currentPlayer.hand.length === 0) {
        isBotTurn = false;
        document.getElementById('game-container').classList.remove('board-locked');
        
        showWinScreen(currentPlayer.name);
        return;
    }

    if (madeMove) {
        setTimeout(executeAIMoves, 1600); 
    } else {
        setTimeout(() => {
            isBotTurn = false;
            document.getElementById('game-container').classList.remove('board-locked');

            document.getElementById('end-turn-btn').disabled = false;
            document.getElementById('undo-btn').disabled = false;
            gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
            gameState.hasDrawnThisTurn = false; 
            saveGame();
            showHoldScreen();
        }, 1200);
    }
}

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
