const MAX_DECK_SIZE = 20;
const MAX_COPIES_PER_CARD = 3;
const FALLBACK_ACTIVE_CARDS = [
    { name: 'DoubleShot', description: 'place 2 cards in one go worth 2 points.', value: 1 },
    { name: 'Swap', description: 'swap any 2 cards on the board.', value: 3 },
    { name: 'Clone', description: 'clone any card on the board.', value: 5 },
    { name: 'Shield', description: 'place a shield on any cell.', value: 4 },
    { name: 'Bomb', description: 'place a bomb on any cell.', value: 6 },
    { name: 'King', description: 'place a king on any cell.', value: 9 },
    { name: 'castle', description: 'place a castle on any cell.', value: 7 }
];

const catalogGrid = document.getElementById('catalog-grid');
const deckGrid = document.getElementById('deck-grid');
const deckCountEl = document.getElementById('deck-count');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const saveMsg = document.getElementById('save-msg');

let catalog = [];
let myDeck = [];

function loadSavedDeck() {
    const saved = localStorage.getItem('customDeck');
    if (!saved) {
        myDeck = [];
        return;
    }

    try {
        const parsed = JSON.parse(saved);
        myDeck = Array.isArray(parsed) ? parsed.reduce((deck, card) => {
            const copies = deck.filter(existingCard => existingCard.name === card.name).length;
            if (copies < MAX_COPIES_PER_CARD && deck.length < MAX_DECK_SIZE) {
                deck.push(card);
            }
            return deck;
        }, []) : [];
    } catch (e) {
        console.error('Failed to parse saved deck.', e);
        myDeck = [];
    }
}

async function loadCatalog() {
    catalog = [];

    for (let i = 1; i <= 9; i++) {
        catalog.push({
            type: 'counter',
            name: i.toString(),
            value: i,
            description: 'Standard number counter. Can capture lower values.'
        });
    }

    let activeCards = FALLBACK_ACTIVE_CARDS;

    try {
        const response = await fetch('ActiveCards.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data.ActiveCards) && data.ActiveCards.length > 0) {
            activeCards = data.ActiveCards;
        }
    } catch (e) {
        console.warn('Falling back to the built-in card list.', e);
    }

    activeCards.forEach(card => {
        catalog.push({
            type: 'active',
            name: card.name,
            value: '?',
            description: card.description
        });
    });
}

function createCardHTML(card) {
    const typeClass = card.type === 'active' ? 'type-active' : 'type-counter';
    const typeLabel = card.type === 'active' ? 'Spell' : 'Unit';

    return `
        <div class="card-header">
            <span class="card-name">${card.name}</span>
            <span class="card-type ${typeClass}">${typeLabel}</span>
        </div>
        <div class="card-body">
            <span class="card-value">${card.value}</span>
        </div>
        <div class="card-footer">
            <span class="card-ability">${card.description}</span>
        </div>
    `;
}

function renderCatalog() {
    if (!catalogGrid) return;

    catalogGrid.innerHTML = '';
    catalog.forEach((card) => {
        const cardBtn = document.createElement('button');
        cardBtn.type = 'button';
        cardBtn.className = 'detailed-card catalog-card';
        cardBtn.innerHTML = createCardHTML(card);
        cardBtn.addEventListener('click', () => addToDeck(card));
        catalogGrid.appendChild(cardBtn);
    });
}

function renderDeck() {
    if (!deckGrid || !deckCountEl) return;

    deckGrid.innerHTML = '';
    deckCountEl.textContent = `${myDeck.length}/${MAX_DECK_SIZE}`;

    for (let i = 0; i < MAX_DECK_SIZE; i++) {
        if (i < myDeck.length) {
            const card = myDeck[i];
            const cardBtn = document.createElement('button');
            cardBtn.type = 'button';
            cardBtn.className = 'detailed-card';
            cardBtn.innerHTML = createCardHTML(card);
            cardBtn.addEventListener('click', () => removeFromDeck(i));
            deckGrid.appendChild(cardBtn);
        } else {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.textContent = 'Empty Slot';
            deckGrid.appendChild(slot);
        }
    }
}

function addToDeck(card) {
    if (myDeck.length >= MAX_DECK_SIZE) {
        alert('Deck is full! Remove a card first.');
        return;
    }

    const copies = myDeck.filter(deckCard => deckCard.name === card.name).length;
    if (copies >= MAX_COPIES_PER_CARD) {
        alert(`You can only have ${MAX_COPIES_PER_CARD} copies of each card.`);
        return;
    }

    myDeck.push(JSON.parse(JSON.stringify(card)));
    renderDeck();
}

function removeFromDeck(index) {
    myDeck.splice(index, 1);
    renderDeck();
}

async function initDeckBuilder() {
    if (!catalogGrid || !deckGrid || !deckCountEl || !saveBtn || !clearBtn || !saveMsg) {
        return;
    }

    await loadCatalog();
    loadSavedDeck();
    renderCatalog();
    renderDeck();

    saveBtn.addEventListener('click', () => {
        if (myDeck.length !== MAX_DECK_SIZE) {
            alert(`You must have exactly ${MAX_DECK_SIZE} cards in your deck to save.`);
            return;
        }

        localStorage.setItem('customDeck', JSON.stringify(myDeck));
        saveMsg.textContent = `Deck saved with ${myDeck.length} cards.`;
        saveMsg.style.display = 'block';
        setTimeout(() => saveMsg.style.display = 'none', 3000);
    });

    clearBtn.addEventListener('click', () => {
        myDeck = [];
        renderDeck();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeckBuilder);
} else {
    initDeckBuilder();
}
