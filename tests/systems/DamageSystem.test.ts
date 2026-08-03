import { DamageSystem } from '../../src/systems/DamageSystem';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  return createTestDeck([createTestCharacter({ cardId: 'VANILLA' })], count);
}

describe('DamageSystem.calculateDamage', () => {
  const ds = new DamageSystem();

  test('default damage = 1', () => {
    expect(ds.calculateDamage({})).toBe(1);
  });

  test('Damage 2 multiplier → damage = 2', () => {
    expect(ds.calculateDamage({ multiplier: 2 })).toBe(2);
  });

  test('Damage +1 bonus → damage = 2', () => {
    expect(ds.calculateDamage({ bonus: 1 })).toBe(2);
  });

  test('Damage 2 + Damage +1 → damage = 3', () => {
    expect(ds.calculateDamage({ multiplier: 2, bonus: 1 })).toBe(3);
  });
});

describe('DamageSystem.extractDamageModifiers', () => {
  const ds = new DamageSystem();

  test('extracts SetDamageMultiplier', () => {
    const mods = ds.extractDamageModifiers([
      { effectType: 'SetDamageMultiplier', params: { amount: 2 } },
    ]);
    expect(mods.multiplier).toBe(2);
  });

  test('extracts ModifyDamage bonus', () => {
    const mods = ds.extractDamageModifiers([
      { effectType: 'ModifyDamage', params: { amount: 1 } },
    ]);
    expect(mods.bonus).toBe(1);
  });

  test('no damage modifiers → empty', () => {
    const mods = ds.extractDamageModifiers([
      { effectType: 'DrawCard', params: { count: 1 } },
    ]);
    expect(mods.multiplier).toBeUndefined();
    expect(mods.bonus).toBeUndefined();
  });
});

describe('DamageSystem.dealDamage', () => {
  const ds = new DamageSystem();

  test('1 damage → 1 life card revealed', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const lifeBefore = state.players['p2'].lifeArea.length;

    const result = ds.dealDamage(state, 'p2', 1, 'p1');
    expect(result.lifeCardsRevealed.length).toBe(1);
    expect(result.changes.length).toBe(1);
  });

  test('2 damage → 2 life cards revealed', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    const result = ds.dealDamage(state, 'p2', 2, 'p1');
    expect(result.lifeCardsRevealed.length).toBe(2);
    expect(result.changes.length).toBe(2);
  });

  test('damage capped at remaining life', () => {
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    state.players['p2'].lifeArea = state.players['p2'].lifeArea.slice(0, 1); // Only 1 life left

    const result = ds.dealDamage(state, 'p2', 5, 'p1');
    expect(result.lifeCardsRevealed.length).toBe(1);
  });
});
