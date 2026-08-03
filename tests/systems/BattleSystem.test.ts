import { BattleSystem } from '../../src/systems/BattleSystem';
import { AbilitySystem } from '../../src/systems/AbilitySystem';
import { DamageSystem } from '../../src/systems/DamageSystem';
import { TriggerSystem } from '../../src/systems/TriggerSystem';
import { EventBus } from '../../src/core/EventBus';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  return createTestDeck([createTestCharacter({ cardId: 'VANILLA' })], count);
}

function createBattleSystem() {
  const eventBus = new EventBus();
  const as = new AbilitySystem(eventBus);
  const ds = new DamageSystem();
  const ts = new TriggerSystem(as);
  return { bs: new BattleSystem(eventBus, as, ds, ts), eventBus, as, ds, ts };
}

describe('BattleSystem — declareAttack', () => {
  test('Active character → Resting, battle created', () => {
    const { bs } = createBattleSystem();
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Attack';

    state.players['p1'].frontLine.push({
      cardId: 'C1', instanceId: 'inst-atk', ownerId: 'p1',
      faceUp: true, state: 'Active', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const result = bs.declareAttack(state, 'inst-atk', 'Player');
    expect(result.newState.battleState).not.toBeNull();
    expect(result.newState.battleState!.step).toBe('BlockerDeclaration');
    expect(result.newState.players['p1'].frontLine[0].state).toBe('Resting');
  });

  test('non-Active character cannot attack', () => {
    const { bs } = createBattleSystem();
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Attack';

    state.players['p1'].frontLine.push({
      cardId: 'C1', instanceId: 'inst-r', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    const result = bs.declareAttack(state, 'inst-r', 'Player');
    expect(result.newState.battleState).toBeNull();
  });
});

describe('BattleSystem — declareBlock', () => {
  test('Active defender can block', () => {
    const { bs } = createBattleSystem();
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Attack';
    (state as any).battleState = {
      step: 'BlockerDeclaration',
      attacker: { cardInstanceId: 'inst-atk', bpAtDeclaration: 3000 },
      target: { type: 'Player', playerId: 'p2' },
      blocker: null, isSnipe: false, damageDealt: 0,
    };
    state.players['p2'].frontLine.push({
      cardId: 'C2', instanceId: 'inst-blk', ownerId: 'p2',
      faceUp: true, state: 'Active', currentBP: 2500, raidedBy: null, raiding: null,
    });

    const result = bs.declareBlock(state, 'inst-blk');
    expect(result.newState.battleState!.blocker).not.toBeNull();
    expect(result.newState.battleState!.blocker!.cardInstanceId).toBe('inst-blk');
    expect(result.newState.players['p2'].frontLine[0].state).toBe('Resting');
  });
});

describe('BattleSystem — resolveBattle (BP comparison)', () => {
  test('attacker BP >= blocker BP → attacker wins, blocker sidelined', () => {
    const { bs } = createBattleSystem();
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Attack';

    state.players['p1'].frontLine.push({
      cardId: 'ATK', instanceId: 'inst-atk', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 4000, raidedBy: null, raiding: null,
    });
    state.players['p2'].frontLine.push({
      cardId: 'BLK', instanceId: 'inst-blk', ownerId: 'p2',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    (state as any).battleState = {
      step: 'Resolving',
      attacker: { cardInstanceId: 'inst-atk', bpAtDeclaration: 4000 },
      target: { type: 'Player', playerId: 'p2' },
      blocker: { cardInstanceId: 'inst-blk', bpAtDeclaration: 3000 },
      isSnipe: false, damageDealt: 0,
    };

    const result = bs.resolveBattle(state);
    expect(result.newState.players['p2'].frontLine.length).toBe(0); // Blocker sidelined
    expect(result.log.some((l) => l.includes('attacker wins'))).toBe(true);
    expect(result.newState.battleState).toBeNull(); // Battle ended
  });

  test('attacker BP < blocker BP → attacker loses, blocker stays', () => {
    const { bs } = createBattleSystem();
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Attack';

    state.players['p1'].frontLine.push({
      cardId: 'ATK', instanceId: 'inst-atk', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 2000, raidedBy: null, raiding: null,
    });
    state.players['p2'].frontLine.push({
      cardId: 'BLK', instanceId: 'inst-blk', ownerId: 'p2',
      faceUp: true, state: 'Resting', currentBP: 5000, raidedBy: null, raiding: null,
    });

    (state as any).battleState = {
      step: 'Resolving',
      attacker: { cardInstanceId: 'inst-atk', bpAtDeclaration: 2000 },
      target: { type: 'Player', playerId: 'p2' },
      blocker: { cardInstanceId: 'inst-blk', bpAtDeclaration: 5000 },
      isSnipe: false, damageDealt: 0,
    };

    const result = bs.resolveBattle(state);
    expect(result.newState.players['p2'].frontLine.length).toBe(1); // Blocker stays
    expect(result.log.some((l) => l.includes('attacker loses'))).toBe(true);
  });

  test('BP equal → attacker wins (rule: >= is win)', () => {
    const { bs } = createBattleSystem();
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Attack';

    state.players['p1'].frontLine.push({
      cardId: 'ATK', instanceId: 'inst-atk', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });
    state.players['p2'].frontLine.push({
      cardId: 'BLK', instanceId: 'inst-blk', ownerId: 'p2',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    (state as any).battleState = {
      step: 'Resolving',
      attacker: { cardInstanceId: 'inst-atk', bpAtDeclaration: 3000 },
      target: { type: 'Player', playerId: 'p2' },
      blocker: { cardInstanceId: 'inst-blk', bpAtDeclaration: 3000 },
      isSnipe: false, damageDealt: 0,
    };

    const result = bs.resolveBattle(state);
    expect(result.newState.players['p2'].frontLine.length).toBe(0); // Blocker sidelined (equal = attacker wins)
  });
});

describe('BattleSystem — unblocked damage', () => {
  test('unblocked attack → 1 damage to opponent life', () => {
    const { bs } = createBattleSystem();
    const state = createGameState({ gameId: 't', playerOneId: 'p1', playerTwoId: 'p2', deck1: makeDeck(50), deck2: makeDeck(50) });
    (state as any).phase = 'Attack';

    const lifeBefore = state.players['p2'].lifeArea.length;

    state.players['p1'].frontLine.push({
      cardId: 'ATK', instanceId: 'inst-atk', ownerId: 'p1',
      faceUp: true, state: 'Resting', currentBP: 3000, raidedBy: null, raiding: null,
    });

    (state as any).battleState = {
      step: 'Resolving',
      attacker: { cardInstanceId: 'inst-atk', bpAtDeclaration: 3000 },
      target: { type: 'Player', playerId: 'p2' },
      blocker: null,
      isSnipe: false, damageDealt: 0,
    };

    const result = bs.resolveBattle(state);
    expect(result.newState.players['p2'].lifeArea.length).toBe(lifeBefore - 1);
    expect(result.newState.battleState).toBeNull();
  });
});
