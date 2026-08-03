// ============================================================================
// ActionSystem 单元测试
// ============================================================================

import { ActionSystem } from '../../src/core/ActionSystem';
import { EventBus } from '../../src/core/EventBus';
import { RuleValidator } from '../../src/core/RuleValidator';
import { AbilitySystem } from '../../src/systems/AbilitySystem';
import { EnergySystem } from '../../src/systems/EnergySystem';
import { RaidSystem } from '../../src/systems/RaidSystem';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestSite, createTestEvent, createTestDeck } from '../fixtures/test_cards';
import { GameState, CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

function createActionSystem(allCards: CardData[]) {
  const eventBus = new EventBus();
  const ruleValidator = new RuleValidator();
  const abilitySystem = new AbilitySystem(eventBus);
  const energySystem = new EnergySystem();
  const raidSystem = new RaidSystem();
  const getCardData = (cardId: string) => allCards.find((c) => c.cardId === cardId);
  return { actionSystem: new ActionSystem(eventBus, ruleValidator, abilitySystem, energySystem, raidSystem, getCardData), eventBus, allCards };
}

// Helper: place energy-generating cards on energy line so card plays can be paid for
function addEnergy(state: GameState, playerId: string, color: string, amount: number, getCardData: (id: string) => CardData | undefined) {
  for (let i = 0; i < amount; i++) {
    const energyCard = createTestCharacter({
      cardId: `ENERGY-${color}-${i}`,
      cardName: `Energy ${color}`,
      energyGeneration: [{ color, amount: 1 }],
    });
    state.players[playerId].energyLine.push({
      cardId: `ENERGY-${color}-${i}`,
      instanceId: `inst-energy-${color}-${i}`,
      ownerId: playerId,
      faceUp: true,
      state: 'Resting',
      currentBP: 3000,
      raidedBy: null,
      raiding: null,
    });
  }
}

describe('ActionSystem — submitAction', () => {
  test('rejects action in wrong phase', () => {
    const { actionSystem } = createActionSystem([]);
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    // phase = 'Setup' — no card plays allowed

    const result = actionSystem.submitAction(state, {
      actionType: 'PlayCharacter', playerId: 'p1', cardInstanceId: 'some-id', targetZone: 'FrontLine',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  test('rejects action from non-current player', () => {
    const { actionSystem } = createActionSystem([]);
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Main';

    const result = actionSystem.submitAction(state, {
      actionType: 'PlayCharacter', playerId: 'p2', cardInstanceId: 'x', targetZone: 'FrontLine',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Not your turn');
  });
});

describe('ActionSystem — PlayCharacter', () => {
  test('successfully plays a character to front line', () => {
    const energyGen = createTestCharacter({
      cardId: 'ENGEN', cardName: 'Energy Gen',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const card = createTestCharacter({
      cardId: 'TEST-CH', cardName: 'Test', apCost: 1,
    });
    const { actionSystem } = createActionSystem([energyGen, card]);

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Main';

    // Place energy on energy line
    state.players['p1'].energyLine.push({
      cardId: 'ENGEN', instanceId: 'inst-eng', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });
    // Recalculate AP
    state.players['p1'].availableAP = state.players['p1'].apArea.filter(a => a.state === 'Active').length;

    const handCard = state.players['p1'].hand[0];
    (handCard as any).cardId = 'TEST-CH';

    const result = actionSystem.submitAction(state, {
      actionType: 'PlayCharacter',
      playerId: 'p1',
      cardInstanceId: handCard.instanceId,
      targetZone: 'FrontLine',
    });

    expect(result.success).toBe(true);
    expect(result.newState.players['p1'].hand.length).toBe(state.players['p1'].hand.length - 1);
    expect(result.newState.players['p1'].frontLine.length).toBe(1);
  });

  test('successfully plays a character to energy line', () => {
    const energyGen = createTestCharacter({
      cardId: 'ENGEN2', cardName: 'Energy Gen',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const card = createTestCharacter({ cardId: 'EL-CH', cardName: 'Energy', apCost: 1 });
    const { actionSystem } = createActionSystem([energyGen, card]);

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Main';
    state.players['p1'].energyLine.push({
      cardId: 'ENGEN2', instanceId: 'inst-eng2', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const handCard = state.players['p1'].hand[0];
    (handCard as any).cardId = 'EL-CH';

    const result = actionSystem.submitAction(state, {
      actionType: 'PlayCharacter',
      playerId: 'p1',
      cardInstanceId: handCard.instanceId,
      targetZone: 'EnergyLine',
    });

    expect(result.success).toBe(true);
    expect(result.newState.players['p1'].energyLine.length).toBe(2); // 1 energy gen + 1 new
    expect(result.newState.players['p1'].energyLine[1].state).toBe('Resting');
  });
});

describe('ActionSystem — PlayCharacter with WhenPlayed', () => {
  test('WhenPlayed DrawCard triggers on play', () => {
    const energyGen = createTestCharacter({
      cardId: 'ENGEN3', cardName: 'Energy',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const card = createTestCharacter({
      cardId: 'DRAW-ON-PLAY',
      cardName: 'Drawer',
      apCost: 1,
      abilities: [{
        abilityId: 'DOP-1', timing: 'WhenPlayed', costs: [],
        effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
        isOptional: false,
      }],
    });
    const { actionSystem, eventBus } = createActionSystem([energyGen, card]);

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Main';
    state.players['p1'].energyLine.push({
      cardId: 'ENGEN3', instanceId: 'inst-eng3', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const handCard = state.players['p1'].hand[0];
    (handCard as any).cardId = 'DRAW-ON-PLAY';

    const handBefore = state.players['p1'].hand.length;
    const deckBefore = state.players['p1'].deck.length;

    const result = actionSystem.submitAction(state, {
      actionType: 'PlayCharacter',
      playerId: 'p1',
      cardInstanceId: handCard.instanceId,
      targetZone: 'FrontLine',
    });

    expect(result.success).toBe(true);
    // Hand: -1 (card played) + 1 (WhenPlayed Draw) = same
    expect(result.newState.players['p1'].hand.length).toBe(handBefore);
    // Deck: -1 (drawn)
    expect(result.newState.players['p1'].deck.length).toBe(deckBefore - 1);
    expect(result.newState.players['p1'].frontLine.length).toBe(1);
    expect(result.events.some((e) => e.eventType === 'CardPlayed')).toBe(true);
  });
});

describe('ActionSystem — PlaySite', () => {
  test('plays a site to energy line', () => {
    const energyGen = createTestCharacter({
      cardId: 'ENGEN4', cardName: 'Energy',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const card = createTestSite({ cardId: 'SITE-1', cardName: 'Field', apCost: 1 });
    const { actionSystem } = createActionSystem([energyGen, card]);

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Main';
    state.players['p1'].energyLine.push({
      cardId: 'ENGEN4', instanceId: 'inst-eng4', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const handCard = state.players['p1'].hand[0];
    (handCard as any).cardId = 'SITE-1';

    const result = actionSystem.submitAction(state, {
      actionType: 'PlaySite',
      playerId: 'p1',
      cardInstanceId: handCard.instanceId,
    });

    expect(result.success).toBe(true);
    expect(result.newState.players['p1'].energyLine.length).toBe(2);
  });
});

describe('ActionSystem — UseEvent', () => {
  test('uses event card → goes to Sideline', () => {
    const energyGen = createTestCharacter({
      cardId: 'ENGEN5', cardName: 'Energy',
      energyGeneration: [{ color: '白', amount: 1 }],
    });
    const card = createTestEvent({
      cardId: 'EV-1', cardName: 'Quick Draw', apCost: 1,
      abilities: [{
        abilityId: 'EV-1-ABL', timing: 'WhenPlayed', costs: [],
        effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
        isOptional: false,
      }],
    });
    const { actionSystem } = createActionSystem([energyGen, card]);

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Main';
    state.players['p1'].energyLine.push({
      cardId: 'ENGEN5', instanceId: 'inst-eng5', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const handCard = state.players['p1'].hand[0];
    (handCard as any).cardId = 'EV-1';

    const handBefore = state.players['p1'].hand.length;
    const sidelineBefore = state.players['p1'].sideline.length;

    const result = actionSystem.submitAction(state, {
      actionType: 'UseEvent',
      playerId: 'p1',
      cardInstanceId: handCard.instanceId,
    });

    expect(result.success).toBe(true);
    // Hand: -1 (event used) + 1 (DrawCard) = same
    expect(result.newState.players['p1'].hand.length).toBe(handBefore);
    // Event goes to Sideline
    expect(result.newState.players['p1'].sideline.length).toBe(sidelineBefore + 1);
  });
});

describe('ActionSystem — ActivateAbility', () => {
  test('activates ActivateMain ability', () => {
    const card = createTestCharacter({
      cardId: 'ACT-CH',
      cardName: 'Activator',
      apCost: 1,
      abilities: [{
        abilityId: 'ACT-1', timing: 'ActivateMain',
        costs: [{ costType: 'SwitchToResting' }, { costType: 'PayAp', params: { amount: 1 } }],
        effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
        isOptional: true,
      }],
    });
    const { actionSystem } = createActionSystem([card]);

    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Main';

    // Place card on front line (Active)
    state.players['p1'].frontLine.push({
      cardId: 'ACT-CH', instanceId: 'inst-act', ownerId: 'p1',
      faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const handBefore = state.players['p1'].hand.length;

    const result = actionSystem.submitAction(state, {
      actionType: 'ActivateAbility',
      playerId: 'p1',
      cardInstanceId: 'inst-act',
      abilityId: 'ACT-1',
    });

    expect(result.success).toBe(true);
    // Drew 1 card
    expect(result.newState.players['p1'].hand.length).toBe(handBefore + 1);
    // Card switched to Resting (cost paid)
    expect(result.newState.players['p1'].frontLine[0].state).toBe('Resting');
  });
});

describe('ActionSystem — ExtraDraw', () => {
  test('pays 1AP to draw 1 card', () => {
    const { actionSystem } = createActionSystem([]);
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Start';

    const apBefore = state.players['p1'].availableAP;
    const handBefore = state.players['p1'].hand.length;

    const result = actionSystem.submitAction(state, {
      actionType: 'ExtraDraw', playerId: 'p1',
    });

    expect(result.success).toBe(true);
    expect(result.newState.players['p1'].availableAP).toBe(apBefore - 1);
    expect(result.newState.players['p1'].hand.length).toBe(handBefore + 1);
  });
});
