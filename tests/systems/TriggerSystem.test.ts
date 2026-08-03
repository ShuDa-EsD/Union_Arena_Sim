import { TriggerSystem } from '../../src/systems/TriggerSystem';
import { AbilitySystem } from '../../src/systems/AbilitySystem';
import { EventBus } from '../../src/core/EventBus';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  return createTestDeck([createTestCharacter({ cardId: 'VANILLA' })], count);
}

describe('TriggerSystem.hasTrigger', () => {
  const eventBus = new EventBus();
  const as = new AbilitySystem(eventBus);
  const ts = new TriggerSystem(as);

  test('card with trigger → true', () => {
    const cardData = createTestCharacter({
      cardId: 'TRG-CARD',
      trigger: { abilityId: 'T1', timing: 'Trigger', costs: [], effects: [{ effectType: 'DrawCard', params: { count: 1 } }], isOptional: true },
    });
    const lookup = (id: string) => id === 'TRG-CARD' ? cardData : undefined;

    expect(ts.hasTrigger({ cardId: 'TRG-CARD', instanceId: 'i', ownerId: 'p1', faceUp: false }, lookup)).toBe(true);
  });

  test('card without trigger → false', () => {
    const cardData = createTestCharacter({ cardId: 'NO-TRG' });
    const lookup = (id: string) => id === 'NO-TRG' ? cardData : undefined;

    expect(ts.hasTrigger({ cardId: 'NO-TRG', instanceId: 'i', ownerId: 'p1', faceUp: false }, lookup)).toBe(false);
  });
});

describe('TriggerSystem.processTriggers', () => {
  const eventBus = new EventBus();
  const as = new AbilitySystem(eventBus);
  const ts = new TriggerSystem(as);

  test('processes trigger card — activates and draws', () => {
    const trigCard = createTestCharacter({
      cardId: 'TRG-ACT',
      trigger: { abilityId: 'TRG-1', timing: 'Trigger', costs: [], effects: [{ effectType: 'DrawCard', params: { count: 1 } }], isOptional: true },
    });
    const lookup = (id: string) => id === 'TRG-ACT' ? trigCard : undefined;

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const handBefore = state.players['p2'].hand.length;

    // Place trigger card in Sideline (where DamageSystem puts it after revealing)
    state.players['p2'].sideline.push({
      cardId: 'TRG-ACT', instanceId: 'inst-trg', ownerId: 'p2', faceUp: true,
    });

    const lifeCard = { cardId: 'TRG-ACT', instanceId: 'inst-trg', ownerId: 'p2', faceUp: true };
    const result = ts.processTriggers(state, [lifeCard], 'p2', lookup);

    // Trigger draws 1 card
    expect(result.newState.players['p2'].hand.length).toBe(handBefore + 1);
    expect(result.log.some((l) => l.includes('activated'))).toBe(true);
  });

  test('non-trigger card → no activation, no draw', () => {
    const normalCard = createTestCharacter({ cardId: 'NORMAL' });
    const lookup = (id: string) => id === 'NORMAL' ? normalCard : undefined;

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const handBefore = state.players['p2'].hand.length;

    const lifeCard = { cardId: 'NORMAL', instanceId: 'inst-norm', ownerId: 'p2', faceUp: true };
    const result = ts.processTriggers(state, [lifeCard], 'p2', lookup);

    expect(result.newState.players['p2'].hand.length).toBe(handBefore);
    expect(result.log.some((l) => l.includes('No trigger'))).toBe(true);
  });
});
