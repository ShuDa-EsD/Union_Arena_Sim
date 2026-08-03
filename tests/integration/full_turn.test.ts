// ============================================================================
// 完整回合集成测试
// ============================================================================

import { TurnManager } from '../../src/core/TurnManager';
import { EventBus } from '../../src/core/EventBus';
import { RuleValidator } from '../../src/core/RuleValidator';
import { EnergySystem } from '../../src/systems/EnergySystem';
import { MovementSystem } from '../../src/systems/MovementSystem';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { GameState, CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

function advanceN(tm: TurnManager, state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) {
    state = tm.advancePhase(state).newState;
  }
  return state;
}

describe('Full Turn Integration', () => {
  let eventBus: EventBus;
  let turnManager: TurnManager;
  let ruleValidator: RuleValidator;

  beforeEach(() => {
    eventBus = new EventBus();
    turnManager = new TurnManager(eventBus);
    ruleValidator = new RuleValidator();
  });

  test('P1 Turn 1: complete cycle (no Attack, RQ-008)', () => {
    let state = createGameState({
      gameId: 'full-turn-test',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    // P1 T1: Setup→Start→Movement→Main→End = 5 advances
    state = advanceN(turnManager, state, 5);

    // Should have advanced to P2 T1 Start
    expect(state.currentPlayerId).toBe('p2');
    expect(state.turnNumber).toBe(1);

    // P1 should NOT have drawn (first turn skip)
    // 7 initial hand, no draw
    expect(state.players['p1'].hand.length).toBe(7);
  });

  test('P2 Turn 1: has Attack phase, draws at Start', () => {
    let state = createGameState({
      gameId: 'full-turn-test',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    // Advance through P1 T1 (5) to enter P2 T1 Start
    state = advanceN(turnManager, state, 5);
    expect(state.phase).toBe('Start');
    expect(state.currentPlayerId).toBe('p2');

    // P2 drew a card at Start Phase
    expect(state.players['p2'].hand.length).toBe(8); // 7 initial + 1 draw

    // P2: Start→Movement→Main→Attack→End = 5 more
    state = advanceN(turnManager, state, 5);
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(2);
  });

  test('P1 Turn 2: draws card, AP adjusts to 2', () => {
    let state = createGameState({
      gameId: 'full-turn-test',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    // Advance to P1 T2 Start: P1 T1(5) + P2 T1(5) = 10
    state = advanceN(turnManager, state, 10);

    expect(state.phase).toBe('Start');
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(2);

    // P1 drew a card
    expect(state.players['p1'].hand.length).toBe(8); // 7 initial + 1 draw
    // AP adjusts from 1 to 2
    expect(state.players['p1'].apArea.length).toBe(2);
  });

  test('phase permissions: Movement only allows MoveCharacter', () => {
    // Phase permissions are static, test directly
    expect(ruleValidator.isActionAllowedInPhase('MoveCharacter', 'Movement')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('PlayCharacter', 'Movement')).toBe(false);
    expect(ruleValidator.isActionAllowedInPhase('ActivateAbility', 'Movement')).toBe(false);
  });

  test('phase permissions: Main allows card plays and abilities', () => {
    expect(ruleValidator.isActionAllowedInPhase('PlayCharacter', 'Main')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('PlaySite', 'Main')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('UseEvent', 'Main')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('ActivateAbility', 'Main')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('DeclareAttack', 'Main')).toBe(false);
  });

  test('phase permissions: Attack only allows battle actions', () => {
    expect(ruleValidator.isActionAllowedInPhase('DeclareAttack', 'Attack')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('DeclareBlock', 'Attack')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('ActivateTrigger', 'Attack')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('EndAttackPhase', 'Attack')).toBe(true);
    expect(ruleValidator.isActionAllowedInPhase('PlayCharacter', 'Attack')).toBe(false);
  });

  test('multiple cycle: P1 T1 → P2 T1 → P1 T2 → P2 T2 → P1 T3', () => {
    let state = createGameState({
      gameId: 'full-turn-test',
      playerOneId: 'p1',
      playerTwoId: 'p2',
      deck1: makeDeck(50),
      deck2: makeDeck(50),
    });

    // P1 T1 (5) + P2 T1 (5) = 10 → P1 T2 Start
    state = advanceN(turnManager, state, 10);
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(2);
    expect(state.players['p1'].apArea.length).toBe(2);

    // P1 T2 (5) + P2 T2 (5) = 10 → P1 T3 Start
    state = advanceN(turnManager, state, 10);
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(3);
    expect(state.players['p1'].apArea.length).toBe(3);

    // Verify no crashes, game still running
    expect(state.phase).toBe('Start');
    expect(state.winner).toBeNull();
  });
});
