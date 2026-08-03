// ============================================================================
// AbilitySystem 单元测试
// ============================================================================

import { AbilitySystem } from '../../src/systems/AbilitySystem';
import { EventBus } from '../../src/core/EventBus';
import { createGameState, applyChanges } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { GameState, CardData, AbilityInstance, CardOnField, GameEvent } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

function makeLookup(cards: CardData[]) {
  return (cardId: string) => cards.find((c) => c.cardId === cardId);
}

// ============================================================================
// ConditionEvaluator
// ============================================================================

describe('AbilitySystem — ConditionEvaluator', () => {
  let abilitySystem: AbilitySystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    abilitySystem = new AbilitySystem(eventBus);
  });

  test('null/undefined condition → true', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i1', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };
    expect(abilitySystem.evaluateCondition(undefined, state, ctx)).toBe(true);
  });

  test('IfOnFrontLine: true when card is on front line', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const p1 = state.players['p1'];
    const card: CardOnField = { cardId: 'C1', instanceId: 'i1', ownerId: 'p1', faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null };
    p1.frontLine.push(card);

    const ctx = { sourceCardInstanceId: 'i1', sourcePlayerId: 'p1', sourceCard: card, triggeringEvent: {} as GameEvent };
    expect(abilitySystem.evaluateCondition({ conditionType: 'IfOnFrontLine' }, state, ctx)).toBe(true);
  });

  test('IfOnFrontLine: false when card is on energy line', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const p1 = state.players['p1'];
    const card: CardOnField = { cardId: 'C1', instanceId: 'i2', ownerId: 'p1', faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null };
    p1.energyLine.push(card);

    const ctx = { sourceCardInstanceId: 'i2', sourcePlayerId: 'p1', sourceCard: card, triggeringEvent: {} as GameEvent };
    expect(abilitySystem.evaluateCondition({ conditionType: 'IfOnFrontLine' }, state, ctx)).toBe(false);
  });

  test('IfActive: checks field state', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const card: CardOnField = { cardId: 'C1', instanceId: 'i3', ownerId: 'p1', faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null };
    state.players['p1'].frontLine.push(card);

    const ctx = { sourceCardInstanceId: 'i3', sourcePlayerId: 'p1', sourceCard: card, triggeringEvent: {} as GameEvent };
    expect(abilitySystem.evaluateCondition({ conditionType: 'IfActive' }, state, ctx)).toBe(true);

    card.state = 'Resting';
    expect(abilitySystem.evaluateCondition({ conditionType: 'IfActive' }, state, ctx)).toBe(false);
  });

  test('IfOpponentHasCharacter', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };

    // P2 has no front line characters
    expect(abilitySystem.evaluateCondition({ conditionType: 'IfOpponentHasCharacter' }, state, ctx)).toBe(false);

    // Add character to P2 front line
    state.players['p2'].frontLine.push({ cardId: 'C', instanceId: 'opp', ownerId: 'p2', faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null } as CardOnField);
    expect(abilitySystem.evaluateCondition({ conditionType: 'IfOpponentHasCharacter' }, state, ctx)).toBe(true);
  });

  test('And/Or/Not compound conditions', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const activeCard: CardOnField = {
      cardId: 'C', instanceId: 'i', ownerId: 'p1', faceUp: true,
      state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    };
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: activeCard, triggeringEvent: {} as GameEvent };

    // No opponent character → false, IfActive → true (card is Active), AND → false
    expect(abilitySystem.evaluateCondition({
      conditionType: 'And',
      subConditions: [{ conditionType: 'IfOpponentHasCharacter' }, { conditionType: 'IfActive' }],
    }, state, ctx)).toBe(false);

    // No opponent character → false, IfActive → true, OR → true
    expect(abilitySystem.evaluateCondition({
      conditionType: 'Or',
      subConditions: [{ conditionType: 'IfOpponentHasCharacter' }, { conditionType: 'IfActive' }],
    }, state, ctx)).toBe(true);

    // No opponent character → false, NOT → true
    expect(abilitySystem.evaluateCondition({
      conditionType: 'Not',
      subCondition: { conditionType: 'IfOpponentHasCharacter' },
    }, state, ctx)).toBe(true);
  });
});

// ============================================================================
// CostPayer
// ============================================================================

describe('AbilitySystem — CostPayer', () => {
  let abilitySystem: AbilitySystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    abilitySystem = new AbilitySystem(eventBus);
  });

  test('SwitchToResting: checkCosts passes when Active', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const card: CardOnField = { cardId: 'C', instanceId: 'i', ownerId: 'p1', faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null };
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: card, triggeringEvent: {} as GameEvent };

    expect(abilitySystem['checkCosts']([{ costType: 'SwitchToResting' }], state, ctx)).toBe(true);
  });

  test('SwitchToResting: checkCosts fails when Resting', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const card: CardOnField = { cardId: 'C', instanceId: 'i', ownerId: 'p1', faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null };
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: card, triggeringEvent: {} as GameEvent };

    expect(abilitySystem['checkCosts']([{ costType: 'SwitchToResting' }], state, ctx)).toBe(false);
  });

  test('PayAp: checkCosts with sufficient AP', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };

    // P1 has 1 AP in Turn 1
    expect(abilitySystem['checkCosts']([{ costType: 'PayAp', params: { amount: 1 } }], state, ctx)).toBe(true);
    expect(abilitySystem['checkCosts']([{ costType: 'PayAp', params: { amount: 2 } }], state, ctx)).toBe(false);
  });

  test('DiscardFromHand: checkCosts with sufficient cards', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };

    // P1 has 7 cards in hand
    expect(abilitySystem['checkCosts']([{ costType: 'DiscardFromHand', params: { amount: 2 } }], state, ctx)).toBe(true);
    expect(abilitySystem['checkCosts']([{ costType: 'DiscardFromHand', params: { amount: 10 } }], state, ctx)).toBe(false);
  });

  test('payCosts generates correct StateChange for PayAp', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };

    const changes = abilitySystem['payCosts']([{ costType: 'PayAp', params: { amount: 1 } }], state, ctx);
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('ADJUST_AP');
    if (changes[0].type === 'ADJUST_AP') {
      expect(changes[0].delta).toBe(-1);
    }
  });
});

// ============================================================================
// EffectExecutor
// ============================================================================

describe('AbilitySystem — EffectExecutor', () => {
  let abilitySystem: AbilitySystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    abilitySystem = new AbilitySystem(eventBus);
  });

  test('DrawCard effect generates DRAW_CARD change', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };
    const getData = () => undefined;

    const result = abilitySystem.executeEffects(
      [{ effectType: 'DrawCard', params: { count: 1 } }],
      state, ctx, getData,
    );

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('DRAW_CARD');
  });

  test('BpBuff effect generates UPDATE_BP change', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };
    const getData = () => undefined;

    const result = abilitySystem.executeEffects(
      [{ effectType: 'BpBuff', params: { amount: 2000 } }],
      state, ctx, getData,
    );

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('UPDATE_BP');
    if (result.changes[0].type === 'UPDATE_BP') {
      expect(result.changes[0].delta).toBe(2000);
    }
  });

  test('SwitchToActive generates SET_FIELD_STATE change', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };
    const getData = () => undefined;

    const result = abilitySystem.executeEffects(
      [{ effectType: 'SwitchToActive' }],
      state, ctx, getData,
    );

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('SET_FIELD_STATE');
    if (result.changes[0].type === 'SET_FIELD_STATE') {
      expect(result.changes[0].state).toBe('Active');
    }
  });

  test('Sequence executes sub-effects in order', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const ctx = { sourceCardInstanceId: 'i', sourcePlayerId: 'p1', sourceCard: {} as CardOnField, triggeringEvent: {} as GameEvent };
    const getData = () => undefined;

    const result = abilitySystem.executeEffects(
      [{
        effectType: 'Sequence',
        params: {
          effects: [
            { effectType: 'DrawCard', params: { count: 1 } },
            { effectType: 'BpBuff', params: { amount: 1000 } },
          ],
        },
      }],
      state, ctx, getData,
    );

    expect(result.changes).toHaveLength(2);
    expect(result.changes[0].type).toBe('DRAW_CARD');
    expect(result.changes[1].type).toBe('UPDATE_BP');
  });
});

// ============================================================================
// TriggerDetector
// ============================================================================

describe('AbilitySystem — TriggerDetector', () => {
  let abilitySystem: AbilitySystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    abilitySystem = new AbilitySystem(eventBus);
  });

  test('detects WhenPlayed ability on CARD_PLAYED event', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });

    const cardData = createTestCharacter({
      cardId: 'WHENPLAY-CH',
      abilities: [{
        abilityId: 'WP-1', timing: 'WhenPlayed', costs: [],
        effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
        isOptional: false,
      }],
    });
    const lookup = makeLookup([cardData]);

    // Place card on field to be detected
    const p1 = state.players['p1'];
    p1.frontLine.push({ cardId: 'WHENPLAY-CH', instanceId: 'inst-wp', ownerId: 'p1', faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null });

    const event: GameEvent = {
      eventType: 'CardPlayed',
      sourcePlayerId: 'p1',
      sourceCardInstanceId: 'inst-wp',
      data: { cardId: 'WHENPLAY-CH' },
    };

    const triggered = abilitySystem.detectTriggeredAbilitiesWithRegistry(state, event, lookup);
    expect(triggered.length).toBe(1);
    expect(triggered[0].abilityData.abilityId).toBe('WP-1');
  });

  test('does not detect WhenPlayed on non-matching event', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });

    const cardData = createTestCharacter({
      cardId: 'WP-CH2',
      abilities: [{
        abilityId: 'WP-2', timing: 'WhenPlayed', costs: [],
        effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
        isOptional: false,
      }],
    });
    const lookup = makeLookup([cardData]);

    state.players['p1'].frontLine.push({ cardId: 'WP-CH2', instanceId: 'inst-wp2', ownerId: 'p1', faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null });

    // Wrong event type
    const event: GameEvent = { eventType: 'TurnStarted', sourcePlayerId: 'p1', data: {} };
    const triggered = abilitySystem.detectTriggeredAbilitiesWithRegistry(state, event, lookup);
    expect(triggered.length).toBe(0);
  });
});

// ============================================================================
// AbilityQueue
// ============================================================================

describe('AbilitySystem — resolveQueue', () => {
  let abilitySystem: AbilitySystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    abilitySystem = new AbilitySystem(eventBus);
  });

  test('empty queue returns unchanged state', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const result = abilitySystem.resolveQueue(state, [], () => undefined);
    expect(result.success).toBe(true);
    expect(result.newState).toBe(state);
  });

  test('resolves a simple DrawCard ability', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const p1 = state.players['p1'];

    const cardData = createTestCharacter({
      cardId: 'DRAW-CH',
      abilities: [{
        abilityId: 'DRAW-1', timing: 'WhenPlayed', costs: [],
        effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
        isOptional: false,
      }],
    });
    const lookup = makeLookup([cardData]);

    p1.frontLine.push({ cardId: 'DRAW-CH', instanceId: 'inst-draw', ownerId: 'p1', faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null });

    const queue: AbilityInstance[] = [{
      instanceId: 'q-1',
      abilityData: cardData.abilities[0],
      sourceCardInstanceId: 'inst-draw',
      sourcePlayerId: 'p1',
      isTrigger: false,
    }];

    const handBefore = p1.hand.length;
    const result = abilitySystem.resolveQueue(state, queue, lookup);
    expect(result.success).toBe(true);
    expect(result.newState.players['p1'].hand.length).toBe(handBefore + 1);
  });
});
