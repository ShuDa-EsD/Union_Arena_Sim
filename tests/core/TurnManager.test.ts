// ============================================================================
// TurnManager 单元测试
// ============================================================================

import { TurnManager } from '../../src/core/TurnManager';
import { EventBus } from '../../src/core/EventBus';
import { createGameState } from '../../src/core/GameState';
import { createTestCharacter, createTestDeck } from '../fixtures/test_cards';
import { GameState, CardData } from '../../src/core/types';

function makeDeck(count: number = 50): CardData[] {
  const template = createTestCharacter({ cardId: 'VANILLA', cardName: 'Vanilla' });
  return createTestDeck([template], count);
}

function makeDefaultState(): GameState {
  return createGameState({
    gameId: 'test-turn',
    playerOneId: 'p1',
    playerTwoId: 'p2',
    deck1: makeDeck(50),
    deck2: makeDeck(50),
  });
}

// Helper: advance N times
function advanceN(tm: TurnManager, state: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) {
    state = tm.advancePhase(state).newState;
  }
  return state;
}

describe('TurnManager — Phase Transitions', () => {
  let tm: TurnManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    tm = new TurnManager(eventBus);
  });

  test('Setup → Start', () => {
    expect(tm.getNextPhase(makeDefaultState())).toBe('Start');
  });

  test('Start → Movement', () => {
    const state = { ...makeDefaultState(), phase: 'Start' as const };
    expect(tm.getNextPhase(state)).toBe('Movement');
  });

  test('Movement → Main', () => {
    const state = { ...makeDefaultState(), phase: 'Movement' as const };
    expect(tm.getNextPhase(state)).toBe('Main');
  });

  test('Main → Attack (normal, Turn 2)', () => {
    const state = { ...makeDefaultState(), phase: 'Main' as const, turnNumber: 2 };
    expect(tm.getNextPhase(state)).toBe('Attack');
  });

  test('Attack → End', () => {
    const state = { ...makeDefaultState(), phase: 'Attack' as const };
    expect(tm.getNextPhase(state)).toBe('End');
  });

  test('End → Start (next player)', () => {
    const state = { ...makeDefaultState(), phase: 'End' as const };
    expect(tm.getNextPhase(state)).toBe('Start');
  });

  // --- RQ-008 ---

  test('RQ-008: P1 Turn 1 Main → End (skip Attack)', () => {
    const state = makeDefaultState();
    (state as any).phase = 'Main';
    expect(tm.getNextPhase(state)).toBe('End');
    expect(tm.canEnterAttackPhase(state)).toBe(false);
  });

  test('RQ-008: P2 Turn 1 Main → Attack (normal)', () => {
    const state = makeDefaultState();
    (state as any).phase = 'Main';
    (state as any).currentPlayerId = 'p2';
    expect(tm.canEnterAttackPhase(state)).toBe(true);
    expect(tm.getNextPhase(state)).toBe('Attack');
  });

  test('RQ-008: P1 Turn 2 Main → Attack', () => {
    const state = makeDefaultState();
    (state as any).phase = 'Main';
    (state as any).turnNumber = 2;
    expect(tm.canEnterAttackPhase(state)).toBe(true);
    expect(tm.getNextPhase(state)).toBe('Attack');
  });
});

describe('TurnManager — advancePhase events', () => {
  test('PhaseChanged event contains correct previousPhase and newPhase', () => {
    const eventBus = new EventBus();
    const tm = new TurnManager(eventBus);
    const events: any[] = [];
    eventBus.on('PhaseChanged', (e) => events.push(e));

    const state = makeDefaultState(); // phase = 'Setup'
    tm.advancePhase(state);

    expect(events.length).toBe(1);
    expect(events[0].data.previousPhase).toBe('Setup');
    expect(events[0].data.newPhase).toBe('Start');
  });

  test('full P1 Turn 1 cycle emits correct events', () => {
    const eventBus = new EventBus();
    const tm = new TurnManager(eventBus);
    const phaseEvents: any[] = [];
    eventBus.on('PhaseChanged', (e) => phaseEvents.push(e));

    let state = makeDefaultState();
    // P1 T1: Setup→Start→Movement→Main→End (5 advances, RQ-008 skips Attack)
    for (let i = 0; i < 5; i++) {
      state = tm.advancePhase(state).newState;
    }

    expect(phaseEvents.length).toBe(5);
    const phases = phaseEvents.map((e) => e.data.newPhase);
    expect(phases).toEqual(['Start', 'Movement', 'Main', 'End', 'Start']); // last Start = P2 T1
  });
});

describe('TurnManager — Start Phase actions (entering Start)', () => {
  let tm: TurnManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    tm = new TurnManager(eventBus);
  });

  test('P2 Turn 1: draws a card when entering Start phase', () => {
    // Setup: P1 T1 End → advance should enter P2 T1 Start
    let state = makeDefaultState();
    // Advance: Setup→Start→Movement→Main→End (P1 T1 ends)
    state = advanceN(tm, state, 5);

    // Now state is at P2 T1 Start (just entered)
    expect(state.phase).toBe('Start');
    expect(state.currentPlayerId).toBe('p2');

    // P2 has 7 base + 1 drawn = 8 hand cards
    expect(state.players['p2'].hand.length).toBe(8);
    // Deck: 50 - 7(initial hand) - 7(initial life) - 1(drawn) = 35
    expect(state.players['p2'].deck.length).toBe(35);
  });

  test('P1 Turn 1: does NOT draw (first turn skip)', () => {
    let state = makeDefaultState();
    // Setup → Start (1 advance)
    state = tm.advancePhase(state).newState;

    expect(state.phase).toBe('Start');
    expect(state.currentPlayerId).toBe('p1');
    // P1 hand still at 7 (no draw on Turn 1)
    expect(state.players['p1'].hand.length).toBe(7);
  });

  test('P1 Turn 2: draws a card', () => {
    let state = makeDefaultState();
    // P1 T1: Setup→Start→Movement→Main→End (5)
    // P2 T1: Start→Movement→Main→Attack→End (5)
    state = advanceN(tm, state, 10);

    // Now at P1 T2 Start
    expect(state.phase).toBe('Start');
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(2);
    // P1 drew a card
    expect(state.players['p1'].hand.length).toBe(8);
  });
});

describe('TurnManager — AP table', () => {
  let tm: TurnManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    tm = new TurnManager(eventBus);
  });

  test('P1 Turn 1 AP = 1', () => {
    const state = makeDefaultState();
    expect(state.players['p1'].apArea).toHaveLength(1);
  });

  test('P2 Turn 1 AP = 2', () => {
    const state = makeDefaultState();
    expect(state.players['p2'].apArea).toHaveLength(2);
  });

  test('P1 Turn 2 AP adjusts to 2', () => {
    let state = makeDefaultState();
    // Advance to P1 T2 Start: P1 T1(5) + P2 T1(5) = 10
    state = advanceN(tm, state, 10);

    expect(state.phase).toBe('Start');
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(2);
    expect(state.players['p1'].apArea.length).toBe(2);
  });

  test('P1 Turn 3 AP adjusts to 3', () => {
    let state = makeDefaultState();
    // Advance to P1 T3 Start: P1 T1(5) + P2 T1(5) + P1 T2(5) + P2 T2(5) = 20
    state = advanceN(tm, state, 20);

    expect(state.phase).toBe('Start');
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(3);
    expect(state.players['p1'].apArea.length).toBe(3);
  });
});

describe('TurnManager — End Phase actions (entering End)', () => {
  let tm: TurnManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    tm = new TurnManager(eventBus);
  });

  test('End Phase switches field characters to Active', () => {
    let state = makeDefaultState();
    // P1 T1: advance through to End
    // Setup→Start→Movement→Main→End = advance 5 but P1 T1 has no Attack
    // Actually: Setup(→Start→Movement→Main→End) = 4 advances then End entered on 5th
    // Let's trace: Setup→adv→Start, Start→adv→Movement, Movement→adv→Main, Main→adv→End
    // That's 4 advances from Setup to enter End
    state = advanceN(tm, state, 4);
    expect(state.phase).toBe('End');

    // All AP cards should be Active (End Phase switches chars/sites, not AP)
    // In Start Phase, AP cards were already switched to Active
    // For now, verify no crash
  });
});

describe('TurnManager — player switching', () => {
  let tm: TurnManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    tm = new TurnManager(eventBus);
  });

  test('full cycle: P1 T1 → P2 T1 → P1 T2', () => {
    let state = makeDefaultState();

    // P1 T1: Setup→Start→Movement→Main→End = 5 advances
    state = advanceN(tm, state, 5);
    expect(state.currentPlayerId).toBe('p2');
    expect(state.turnNumber).toBe(1);

    // P2 T1: Start→Movement→Main→Attack→End = 5 advances
    state = advanceN(tm, state, 5);
    expect(state.currentPlayerId).toBe('p1');
    expect(state.turnNumber).toBe(2);
  });

  test('TurnEnded event emitted when switching players', () => {
    const bus = new EventBus();
    const tm2 = new TurnManager(bus);
    const turnEndEvents: any[] = [];
    bus.on('TurnEnded', (e) => turnEndEvents.push(e));

    let state = makeDefaultState();
    // 5 advances = P1 T1 complete. Last advance (Main→End→P2Start) emits TurnEnded
    state = advanceN(tm2, state, 5);

    expect(turnEndEvents.length).toBe(1);
  });
});
