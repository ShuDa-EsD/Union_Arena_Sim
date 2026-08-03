import { RaidSystem } from '../../src/systems/RaidSystem';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  return createTestDeck([createTestCharacter({ cardId: 'VANILLA' })], count);
}

describe('RaidSystem.validateRaidTargetWithRegistry', () => {
  const rs = new RaidSystem();

  test('Name match → valid', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    state.players['p1'].frontLine.push({
      cardId: 'HTR-1-001', instanceId: 'inst-target', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const raidCard = createTestCharacter({
      cardId: 'RAIDER',
      raid: { targetSpecifier: { type: 'Name', value: 'HTR-1-001' }, raidAbilities: [] },
    });
    const targetCard = createTestCharacter({ cardId: 'HTR-1-001', cardName: 'Test Recruit' });
    const lookup = (id: string) => id === 'HTR-1-001' ? targetCard : raidCard;

    const result = rs.validateRaidTargetWithRegistry(state, 'p1', raidCard, 'inst-target', lookup);
    expect(result.valid).toBe(true);
  });

  test('Name mismatch → invalid', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    state.players['p1'].frontLine.push({
      cardId: 'OTHER', instanceId: 'inst-target', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const raidCard = createTestCharacter({
      cardId: 'RAIDER',
      raid: { targetSpecifier: { type: 'Name', value: 'HTR-1-001' }, raidAbilities: [] },
    });
    const targetCard = createTestCharacter({ cardId: 'OTHER', cardName: 'Other' });
    const lookup = (id: string) => id === 'OTHER' ? targetCard : raidCard;

    const result = rs.validateRaidTargetWithRegistry(state, 'p1', raidCard, 'inst-target', lookup);
    expect(result.valid).toBe(false);
  });

  test('Affinity match → valid', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    state.players['p1'].energyLine.push({
      cardId: 'ANY-CARD', instanceId: 'inst-af', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const raidCard = createTestCharacter({
      cardId: 'RAIDER-AF',
      raid: { targetSpecifier: { type: 'Affinity', value: 'Hunter' }, raidAbilities: [] },
    });
    const targetCard = createTestCharacter({ cardId: 'ANY-CARD', affinities: ['Hunter'] });
    const lookup = (id: string) => id === 'ANY-CARD' ? targetCard : raidCard;

    const result = rs.validateRaidTargetWithRegistry(state, 'p1', raidCard, 'inst-af', lookup);
    expect(result.valid).toBe(true);
  });

  test('Target not on field → invalid', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const raidCard = createTestCharacter({
      cardId: 'RAIDER', raid: { targetSpecifier: { type: 'Name', value: 'X' }, raidAbilities: [] },
    });
    const lookup = () => undefined;

    const result = rs.validateRaidTargetWithRegistry(state, 'p1', raidCard, 'nonexistent', lookup);
    expect(result.valid).toBe(false);
  });
});

describe('RaidSystem.performRaid', () => {
  const rs = new RaidSystem();

  test('Raid generates correct StateChanges (AP, move, state)', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    state.players['p1'].frontLine.push({
      cardId: 'HTR-1-001', instanceId: 'inst-target', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });
    // Put raid card in hand
    state.players['p1'].hand[0] = { cardId: 'RAIDER', instanceId: 'inst-raid', ownerId: 'p1', faceUp: false };

    const raidCard = createTestCharacter({
      cardId: 'RAIDER', apCost: 1, bp: { base: 4000 },
      raid: { targetSpecifier: { type: 'Name', value: 'HTR-1-001' }, raidAbilities: [] },
    });

    const result = rs.performRaid(state, 'p1', 'inst-raid', 'inst-target', raidCard, 'FrontLine');

    expect(result.changes.length).toBeGreaterThanOrEqual(2);
    expect(result.changes.some(c => c.type === 'ADJUST_AP')).toBe(true);
    expect(result.changes.some(c => c.type === 'MOVE_CARD')).toBe(true);
    expect(result.events.some(e => e.eventType === 'CardPlayed')).toBe(true);
  });
});
