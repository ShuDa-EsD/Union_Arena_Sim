// ============================================================================
// GameState 单元测试
// ============================================================================

import { createGameState, applyChanges, getPlayer, getPhase, getTurnNumber, getCurrentPlayerId, getWinner, getOpponentId } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { GameState, CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

describe('GameState.createGameState', () => {
  test('should create initial game state with correct structure', () => {
    const state = createGameState({
      gameId: 'test-1',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    expect(state.gameId).toBe('test-1');
    expect(state.phase).toBe('Setup');
    expect(state.turnNumber).toBe(1);
    expect(state.currentPlayerId).toBe('p1');
    expect(state.battleState).toBeNull();
    expect(state.stateVersion).toBe(1);
    expect(state.winner).toBeNull();
  });

  test('should have both players', () => {
    const state = createGameState({
      gameId: 'test-1',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    expect(state.players['p1']).toBeDefined();
    expect(state.players['p2']).toBeDefined();
    expect(state.players['p1'].playerOrder).toBe('PlayerOne');
    expect(state.players['p2'].playerOrder).toBe('PlayerTwo');
  });

  test('P1 should have 7 hand, 7 life, deck=36, AP=1 (Turn 1)', () => {
    const state = createGameState({
      gameId: 'test-1',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const p1 = state.players['p1'];
    expect(p1.hand).toHaveLength(7);
    expect(p1.lifeArea).toHaveLength(7);
    expect(p1.deck).toHaveLength(36); // 50 - 7 (hand) - 7 (life)
    expect(p1.apArea).toHaveLength(1);
    expect(p1.apArea[0].state).toBe('Active');
    expect(p1.availableAP).toBe(1);
  });

  test('P2 should have 7 hand, 7 life, deck=36, AP=2 (Turn 1)', () => {
    const state = createGameState({
      gameId: 'test-1',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const p2 = state.players['p2'];
    expect(p2.hand).toHaveLength(7);
    expect(p2.lifeArea).toHaveLength(7);
    expect(p2.deck).toHaveLength(36);
    expect(p2.apArea).toHaveLength(2);
    expect(p2.availableAP).toBe(2);
  });

  test('P1 and P2 decks should be shuffled (different order)', () => {
    const deck1 = Array.from({ length: 50 }, (_, i) =>
      createTestCharacter({ cardId: `CARD-${i}`, cardName: `Card ${i}` })
    );

    const state = createGameState({
      gameId: 'test-1',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: [...deck1],
      deck2: [...deck1],
    });

    const p1DeckIds = state.players['p1'].deck.map((c) => c.cardId);
    const originalIds = deck1.map((c) => c.cardId);
    const sameOrder = p1DeckIds.every((id, i) => id === originalIds[i]);
    expect(sameOrder).toBe(false);
  });

  test('all hand and life cards should be face down', () => {
    const state = createGameState({
      gameId: 'test-1',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    for (const pid of ['p1', 'p2']) {
      const p = state.players[pid];
      for (const c of p.hand) expect(c.faceUp).toBe(false);
      for (const c of p.lifeArea) expect(c.faceUp).toBe(false);
    }
  });
});

describe('GameState read-only queries', () => {
  const state = createGameState({
    gameId: 'test-query',
    playerOneId: 'p1',
    playerTwoId: 'p2',
    deck1: makeDeck(50),
    deck2: makeDeck(50),
  });

  test('getPlayer returns correct player', () => {
    expect(getPlayer(state, 'p1')?.playerId).toBe('p1');
    expect(getPlayer(state, 'p2')?.playerId).toBe('p2');
    expect(getPlayer(state, 'nonexistent')).toBeUndefined();
  });

  test('getPhase / getTurnNumber / getCurrentPlayerId / getWinner', () => {
    expect(getPhase(state)).toBe('Setup');
    expect(getTurnNumber(state)).toBe(1);
    expect(getCurrentPlayerId(state)).toBe('p1');
    expect(getWinner(state)).toBeNull();
  });

  test('getOpponentId', () => {
    expect(getOpponentId(state, 'p1')).toBe('p2');
    expect(getOpponentId(state, 'p2')).toBe('p1');
  });
});

describe('GameState.applyChanges', () => {
  let state: GameState;

  beforeEach(() => {
    state = createGameState({
      gameId: 'test-changes',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });
  });

  // --- MOVE_CARD ---

  test('MOVE_CARD: should move card from deck to hand', () => {
    const card = state.players['p1'].deck[state.players['p1'].deck.length - 1];
    const newState = applyChanges(state, [
      { type: 'MOVE_CARD', instanceId: card.instanceId, from: 'Deck', to: 'Hand', playerId: 'p1' },
    ]);

    expect(newState.players['p1'].deck).toHaveLength(state.players['p1'].deck.length - 1);
    expect(newState.players['p1'].hand).toHaveLength(state.players['p1'].hand.length + 1);
    expect(newState.stateVersion).toBe(state.stateVersion + 1);
  });

  test('MOVE_CARD: should return same state if card not found', () => {
    const newState = applyChanges(state, [
      { type: 'MOVE_CARD', instanceId: 'nonexistent', from: 'Deck', to: 'Hand', playerId: 'p1' },
    ]);
    expect(newState.stateVersion).toBe(state.stateVersion); // unchanged
  });

  // --- DRAW_CARD ---

  test('DRAW_CARD: should draw from deck to hand', () => {
    const deckBefore = state.players['p1'].deck.length;
    const handBefore = state.players['p1'].hand.length;
    const count = 2;

    const newState = applyChanges(state, [
      { type: 'DRAW_CARD', playerId: 'p1', count },
    ]);

    expect(newState.players['p1'].deck).toHaveLength(deckBefore - count);
    expect(newState.players['p1'].hand).toHaveLength(handBefore + count);
    expect(newState.players['p1'].hand[newState.players['p1'].hand.length - 1].faceUp).toBe(false);
  });

  test('DRAW_CARD: should fail if deck empty', () => {
    // Empty the deck
    const p1 = state.players['p1'];
    p1.deck.length = 0;

    const newState = applyChanges(state, [
      { type: 'DRAW_CARD', playerId: 'p1', count: 1 },
    ]);
    expect(newState.stateVersion).toBe(state.stateVersion); // unchanged, atomic fail
  });

  // --- Immutability ---

  test('should not mutate original state', () => {
    const originalDeckLen = state.players['p1'].deck.length;
    const originalVersion = state.stateVersion;

    const card = state.players['p1'].deck[state.players['p1'].deck.length - 1];
    applyChanges(state, [
      { type: 'MOVE_CARD', instanceId: card.instanceId, from: 'Deck', to: 'Hand', playerId: 'p1' },
    ]);

    // Original unchanged
    expect(state.players['p1'].deck).toHaveLength(originalDeckLen);
    expect(state.stateVersion).toBe(originalVersion);
  });

  // --- SET_FIELD_STATE ---

  test('SET_FIELD_STATE: should change field state', () => {
    // First manually put a card on the field
    const card = state.players['p1'].hand[0];
    let s = applyChanges(state, [
      { type: 'MOVE_CARD', instanceId: card.instanceId, from: 'Hand', to: 'FrontLine', playerId: 'p1' },
    ]);
    // CardOnField defaults are set by toCardOnField which sets Resting... actually
    // the MOVE_CARD doesn't convert to CardOnField. We need to handle this differently.
    // For now, test that SET_FIELD_STATE works on apArea (which has CardOnField)
    const apCard = s.players['p1'].apArea[0];
    expect(apCard.state).toBe('Active');

    const newState = applyChanges(s, [
      { type: 'SET_FIELD_STATE', instanceId: apCard.instanceId, state: 'Resting', playerId: 'p1' },
    ]);
    const updatedAp = newState.players['p1'].apArea[0];
    expect(updatedAp.state).toBe('Resting');
  });

  // --- ADJUST_AP ---

  test('ADJUST_AP: should add AP cards', () => {
    const apBefore = state.players['p1'].apArea.length;
    const newState = applyChanges(state, [
      { type: 'ADJUST_AP', playerId: 'p1', delta: 1 },
    ]);
    expect(newState.players['p1'].apArea).toHaveLength(apBefore + 1);
    expect(newState.players['p1'].apArea[newState.players['p1'].apArea.length - 1].state).toBe('Active');
  });

  test('ADJUST_AP: should remove AP cards', () => {
    const newState = applyChanges(state, [
      { type: 'ADJUST_AP', playerId: 'p2', delta: -1 },
    ]);
    expect(newState.players['p2'].apArea).toHaveLength(1); // P2 starts with 2
  });

  // --- UPDATE_BP ---

  test('UPDATE_BP: should modify currentBP', () => {
    const apCard = state.players['p1'].apArea[0];
    const newState = applyChanges(state, [
      { type: 'UPDATE_BP', instanceId: apCard.instanceId, delta: 1000, playerId: 'p1' },
    ]);
    const updated = newState.players['p1'].apArea[0];
    expect(updated.currentBP).toBe(1000); // AP cards start at 0 BP
  });

  // --- Version increment ---

  test('stateVersion should increment on successful applyChanges', () => {
    const newState = applyChanges(state, [
      { type: 'DRAW_CARD', playerId: 'p1', count: 1 },
    ]);
    expect(newState.stateVersion).toBe(state.stateVersion + 1);
  });

  test('stateVersion should NOT increment on failed applyChanges', () => {
    const newState = applyChanges(state, [
      { type: 'DRAW_CARD', playerId: 'p1', count: 1 },
      { type: 'MOVE_CARD', instanceId: 'nonexistent', from: 'Deck', to: 'Hand', playerId: 'p1' },
    ]);
    // Second change fails → whole batch fails → version unchanged
    expect(newState.stateVersion).toBe(state.stateVersion);
  });
});
