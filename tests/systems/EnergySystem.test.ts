// ============================================================================
// EnergySystem 单元测试
// ============================================================================

import { EnergySystem } from '../../src/systems/EnergySystem';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestSite, createTestDeck } from '../fixtures/test_cards';
import { CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

// Simple CardData lookup
function makeLookup(cards: CardData[]) {
  return (cardId: string) => cards.find((c) => c.cardId === cardId);
}

describe('EnergySystem.calculateEnergyWithRegistry', () => {
  const energySystem = new EnergySystem();

  test('empty energy line → empty pool', () => {
    const state = createGameState({
      gameId: 'test-eng',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const pool = energySystem.calculateEnergyWithRegistry(state, 'p1', () => undefined);
    expect(Object.keys(pool)).toHaveLength(0);
  });

  test('single color energy generation', () => {
    const state = createGameState({
      gameId: 'test-eng',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    // Card has energyGeneration: [{ color: '白', amount: 1 }]
    const cardData = createTestCharacter({
      cardId: 'TEST-CH',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const lookup = makeLookup([cardData]);

    // Manually add card to energy line
    const p1 = state.players['p1'];
    p1.energyLine.push({
      cardId: 'TEST-CH',
      instanceId: 'inst-test-1',
      ownerId: 'p1',
      faceUp: true,
      state: 'Resting',
      currentBP: 3000,
      raidedBy: null,
      raiding: null,
    });

    const pool = energySystem.calculateEnergyWithRegistry(state, 'p1', lookup);
    expect(pool['白']).toBe(1);
  });

  test('multiple cards — same color', () => {
    const state = createGameState({
      gameId: 'test-eng',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const cardData = createTestCharacter({
      cardId: 'W-CHAR',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const lookup = makeLookup([cardData]);

    const p1 = state.players['p1'];
    for (let i = 0; i < 3; i++) {
      p1.energyLine.push({
        cardId: 'W-CHAR',
        instanceId: `inst-${i}`,
        ownerId: 'p1',
        faceUp: true,
        state: 'Resting',
        currentBP: 3000,
        raidedBy: null,
        raiding: null,
      });
    }

    const pool = energySystem.calculateEnergyWithRegistry(state, 'p1', lookup);
    expect(pool['白']).toBe(3);
  });

  test('multiple colors', () => {
    const state = createGameState({
      gameId: 'test-eng',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const whiteCard = createTestCharacter({
      cardId: 'W-CH',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const redCard = createTestSite({
      cardId: 'R-SITE',
      energyGeneration: [{ color: '红', amount: 1 }],
    });
    const lookup = makeLookup([whiteCard, redCard]);

    const p1 = state.players['p1'];
    p1.energyLine.push({
      cardId: 'W-CH', instanceId: 'inst-w', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });
    p1.energyLine.push({
      cardId: 'R-SITE', instanceId: 'inst-r', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 0, raidedBy: null, raiding: null,
    });

    const pool = energySystem.calculateEnergyWithRegistry(state, 'p1', lookup);
    expect(pool['白']).toBe(1);
    expect(pool['红']).toBe(1);
  });

  test('front line cards do NOT contribute energy', () => {
    const state = createGameState({
      gameId: 'test-eng',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const cardData = createTestCharacter({
      cardId: 'FL-CH',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const lookup = makeLookup([cardData]);

    // Place card on front line, NOT energy line
    const p1 = state.players['p1'];
    p1.frontLine.push({
      cardId: 'FL-CH', instanceId: 'inst-fl', ownerId: 'p1',
      faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const pool = energySystem.calculateEnergyWithRegistry(state, 'p1', lookup);
    expect(pool['白'] || 0).toBe(0);
  });
});

describe('EnergySystem.canAfford', () => {
  const energySystem = new EnergySystem();

  test('can afford when energy is sufficient', () => {
    const state = createGameState({
      gameId: 'test-afford',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const cardOnField = createTestCharacter({
      cardId: 'GEN',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const lookup = makeLookup([cardOnField]);

    // Add 3 energy to pool
    const p1 = state.players['p1'];
    for (let i = 0; i < 3; i++) {
      p1.energyLine.push({
        cardId: 'GEN', instanceId: `inst-g${i}`, ownerId: 'p1',
        faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
      });
    }

    // Card requires 白×2
    const cardToPlay = createTestCharacter({
      cardId: 'COST2',
      requiredEnergy: { color: '白', amount: 2 },
    });

    expect(energySystem.canAfford(state, 'p1', cardToPlay, lookup)).toBe(true);
  });

  test('cannot afford when energy is insufficient (amount)', () => {
    const state = createGameState({
      gameId: 'test-afford',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const cardOnField = createTestCharacter({
      cardId: 'GEN2',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const lookup = makeLookup([cardOnField]);

    // Only 1 energy
    const p1 = state.players['p1'];
    p1.energyLine.push({
      cardId: 'GEN2', instanceId: 'inst-g1', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    // Card requires 白×3
    const cardToPlay = createTestCharacter({
      cardId: 'COST3',
      requiredEnergy: { color: '白', amount: 3 },
    });

    expect(energySystem.canAfford(state, 'p1', cardToPlay, lookup)).toBe(false);
  });

  test('cannot afford when color does not match', () => {
    const state = createGameState({
      gameId: 'test-afford',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    const whiteGen = createTestCharacter({
      cardId: 'W-GEN',
      energyGeneration: [{ color: '白', amount: 3 }],
    });
    const lookup = makeLookup([whiteGen]);

    const p1 = state.players['p1'];
    p1.energyLine.push({
      cardId: 'W-GEN', instanceId: 'inst-w', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    // Card requires 红×1, but only 白 available
    const cardToPlay = createTestCharacter({
      cardId: 'RED-REQ',
      requiredEnergy: { color: '红', amount: 1 },
    });

    expect(energySystem.canAfford(state, 'p1', cardToPlay, lookup)).toBe(false);
  });
});
