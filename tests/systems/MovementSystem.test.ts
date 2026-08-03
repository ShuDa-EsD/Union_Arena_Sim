// ============================================================================
// MovementSystem 单元测试
// ============================================================================

import { MovementSystem } from '../../src/systems/MovementSystem';
import { createGameState, applyChanges } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

describe('MovementSystem.canMove', () => {
  const ms = new MovementSystem();

  test('should allow energy line → front line', () => {
    const state = createGameState({
      gameId: 'test-move', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });

    // Manually place a card on energy line
    const p1 = state.players['p1'];
    p1.energyLine.push({
      cardId: 'TEST', instanceId: 'inst-1', ownerId: 'p1',
      faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const result = ms.canMove(state, 'p1', 'inst-1', 'EnergyLine', 'FrontLine');
    expect(result.valid).toBe(true);
  });

  test('should reject front line → energy line (no Step keyword, B5)', () => {
    const state = createGameState({
      gameId: 'test-move', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });

    const p1 = state.players['p1'];
    p1.frontLine.push({
      cardId: 'TEST', instanceId: 'inst-2', ownerId: 'p1',
      faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const result = ms.canMove(state, 'p1', 'inst-2', 'FrontLine', 'EnergyLine');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Step');
  });

  test('should reject invalid source zone', () => {
    const state = createGameState({
      gameId: 'test-move', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });

    const result = ms.canMove(state, 'p1', 'inst-x', 'Hand', 'FrontLine');
    expect(result.valid).toBe(false);
  });

  test('should reject if card not found in source zone', () => {
    const state = createGameState({
      gameId: 'test-move', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });

    const result = ms.canMove(state, 'p1', 'nonexistent', 'EnergyLine', 'FrontLine');
    expect(result.valid).toBe(false);
  });
});

describe('MovementSystem.moveCharacter', () => {
  const ms = new MovementSystem();

  test('should generate MOVE_CARD StateChange', () => {
    const state = createGameState({
      gameId: 'test-move', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });

    const p1 = state.players['p1'];
    p1.energyLine.push({
      cardId: 'TEST', instanceId: 'inst-3', ownerId: 'p1',
      faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const changes = ms.moveCharacter(state, 'p1', 'inst-3', 'EnergyLine', 'FrontLine');
    expect(changes.length).toBeGreaterThanOrEqual(1);
    const moveChange = changes.find((c) => c.type === 'MOVE_CARD');
    expect(moveChange).toBeDefined();
    if (moveChange && moveChange.type === 'MOVE_CARD') {
      expect(moveChange.from).toBe('EnergyLine');
      expect(moveChange.to).toBe('FrontLine');
    }
  });

  test('should handle capacity overflow (target full 4 → remove 1)', () => {
    const state = createGameState({
      gameId: 'test-move', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });

    const p1 = state.players['p1'];
    // Fill front line to 4
    for (let i = 0; i < 4; i++) {
      p1.frontLine.push({
        cardId: 'TEST', instanceId: `inst-fl-${i}`, ownerId: 'p1',
        faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
      });
    }
    // Card to move from energy line
    p1.energyLine.push({
      cardId: 'TEST', instanceId: 'inst-el-0', ownerId: 'p1',
      faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const changes = ms.moveCharacter(state, 'p1', 'inst-el-0', 'EnergyLine', 'FrontLine');

    // Should have: 1 REMOVE (overflow) + 1 MOVE
    const moveChanges = changes.filter((c) => c.type === 'MOVE_CARD');
    expect(moveChanges.length).toBe(2);

    // First change should be overflow removal
    if (moveChanges[0].type === 'MOVE_CARD') {
      expect(moveChanges[0].to).toBe('Sideline');
    }
  });
});
