// ============================================================================
// RuleValidator 单元测试
// ============================================================================

import { RuleValidator } from '../../src/core/RuleValidator';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { CardData, ActionType } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

describe('RuleValidator — Phase Permissions', () => {
  const validator = new RuleValidator();

  // --- Setup ---
  test('Setup: only MulliganDecision allowed', () => {
    expect(validator.isActionAllowedInPhase('MulliganDecision', 'Setup')).toBe(true);
    expect(validator.isActionAllowedInPhase('PlayCharacter', 'Setup')).toBe(false);
    expect(validator.isActionAllowedInPhase('DeclareAttack', 'Setup')).toBe(false);
  });

  // --- Start ---
  test('Start: only ExtraDraw allowed', () => {
    expect(validator.isActionAllowedInPhase('ExtraDraw', 'Start')).toBe(true);
    expect(validator.isActionAllowedInPhase('PlayCharacter', 'Start')).toBe(false);
    expect(validator.isActionAllowedInPhase('MoveCharacter', 'Start')).toBe(false);
  });

  // --- Movement ---
  test('Movement: only MoveCharacter allowed', () => {
    expect(validator.isActionAllowedInPhase('MoveCharacter', 'Movement')).toBe(true);
    expect(validator.isActionAllowedInPhase('PlayCharacter', 'Movement')).toBe(false);
    expect(validator.isActionAllowedInPhase('ActivateAbility', 'Movement')).toBe(false);
  });

  // --- Main ---
  test('Main: card plays and abilities allowed', () => {
    const allowed: ActionType[] = ['PlayCharacter', 'PlaySite', 'UseEvent', 'PerformRaid', 'ActivateAbility', 'EndMainPhase'];
    for (const action of allowed) {
      expect(validator.isActionAllowedInPhase(action, 'Main')).toBe(true);
    }
    expect(validator.isActionAllowedInPhase('DeclareAttack', 'Main')).toBe(false);
    expect(validator.isActionAllowedInPhase('MoveCharacter', 'Main')).toBe(false);
  });

  // --- Attack ---
  test('Attack: only battle actions allowed', () => {
    const allowed: ActionType[] = ['DeclareAttack', 'DeclareBlock', 'ActivateTrigger', 'EndAttackPhase'];
    for (const action of allowed) {
      expect(validator.isActionAllowedInPhase(action, 'Attack')).toBe(true);
    }
    expect(validator.isActionAllowedInPhase('PlayCharacter', 'Attack')).toBe(false);
    expect(validator.isActionAllowedInPhase('ActivateAbility', 'Attack')).toBe(false);
  });

  // --- End ---
  test('End: no actions allowed (auto phase)', () => {
    expect(validator.isActionAllowedInPhase('PlayCharacter', 'End')).toBe(false);
    expect(validator.isActionAllowedInPhase('DeclareAttack', 'End')).toBe(false);
  });

  // --- GameOver ---
  test('GameOver: no actions allowed', () => {
    expect(validator.isActionAllowedInPhase('PlayCharacter', 'GameOver')).toBe(false);
  });
});

describe('RuleValidator — validateAction', () => {
  const validator = new RuleValidator();

  test('should reject action in wrong phase', () => {
    const state = createGameState({
      gameId: 'test-val', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });
    (state as any).phase = 'Movement';

    const result = validator.validateAction(state, 'PlayCharacter', 'p1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  test('should reject action from non-current player', () => {
    const state = createGameState({
      gameId: 'test-val', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });
    (state as any).phase = 'Main';

    const result = validator.validateAction(state, 'PlayCharacter', 'p2');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Not your turn');
  });

  test('should reject when AP insufficient', () => {
    const state = createGameState({
      gameId: 'test-val', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });
    (state as any).phase = 'Main';

    // P1 has 1 AP in turn 1. Try to play a card with apCost=2
    const card = createTestCharacter({ apCost: 2 });
    const result = validator.validateAction(state, 'PlayCharacter', 'p1', {
      cardData: card,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Not enough AP');
  });

  test('should pass with valid phase and AP', () => {
    const state = createGameState({
      gameId: 'test-val', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });
    (state as any).phase = 'Main';

    const card = createTestCharacter({ apCost: 1 });
    const result = validator.validateAction(state, 'PlayCharacter', 'p1', {
      cardData: card,
    });
    expect(result.valid).toBe(true);
  });
});

describe('RuleValidator — canPayAP', () => {
  const validator = new RuleValidator();

  test('P1 turn 1 can pay AP=1', () => {
    const state = createGameState({
      gameId: 'test-ap', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });
    expect(validator.canPayAP(state, 'p1', 1)).toBe(true);
    expect(validator.canPayAP(state, 'p1', 2)).toBe(false);
  });
});

describe('RuleValidator — canPlaceInZone', () => {
  const validator = new RuleValidator();

  test('empty front line should accept', () => {
    const state = createGameState({
      gameId: 'test-zone', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });
    expect(validator.canPlaceInZone(state, 'p1', 'FrontLine')).toBe(true);
  });

  test('full front line (4) should reject', () => {
    const state = createGameState({
      gameId: 'test-zone', playerOneId: 'p1', playerTwoId: 'p2',
      deck1: makeDeck(50), deck2: makeDeck(50),
    });
    const p1 = state.players['p1'];
    for (let i = 0; i < 4; i++) {
      p1.frontLine.push({
        cardId: 'TEST', instanceId: `inst-${i}`, ownerId: 'p1',
        faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
      });
    }
    expect(validator.canPlaceInZone(state, 'p1', 'FrontLine')).toBe(false);
  });
});
