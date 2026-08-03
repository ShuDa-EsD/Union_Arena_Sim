// ============================================================================
// Union Arena Digital — GameState (Batch 1)
// ============================================================================
// 不可变游戏状态 + 区域管理 + 只读查询 + 状态更新。
// ============================================================================

import {
  CardData,
  CardInZone,
  CardOnField,
  GamePhase,
  GameState,
  PlayerState,
  StateChange,
} from './types';
import { shuffle } from '../utils/shuffle';
import { generateInstanceId } from '../utils/idgen';

// ============================================================================
// AP 数量表
// ============================================================================
// Turn 1: P1=1, P2=2 | Turn 2: P1=2, P2=2 | Turn 3+: P1=3, P2=3
function getAPCount(playerOrder: 'PlayerOne' | 'PlayerTwo', turnNumber: number): number {
  if (turnNumber >= 3) return 3;
  if (turnNumber === 2) return 2;
  // Turn 1
  return playerOrder === 'PlayerOne' ? 1 : 2;
}

// ============================================================================
// 内部辅助：将 CardData[] 转为 CardInZone[]
// ============================================================================
function toCardInZone(cards: CardData[], ownerId: string): CardInZone[] {
  return cards.map((card, index) => ({
    cardId: card.cardId,
    instanceId: generateInstanceId(),
    ownerId,
    faceUp: false,
  }));
}

function toCardOnField(cardInZone: CardInZone, bp: number, state: 'Active' | 'Resting'): CardOnField {
  return {
    ...cardInZone,
    state,
    currentBP: bp,
    raidedBy: null,
    raiding: null,
  };
}

function createAPCards(ownerId: string, count: number): CardOnField[] {
  const result: CardOnField[] = [];
  for (let i = 0; i < count; i++) {
    const instance: CardInZone = {
      cardId: 'AP-001',
      instanceId: generateInstanceId(),
      ownerId,
      faceUp: true,
    };
    result.push(toCardOnField(instance, 0, 'Active'));
  }
  return result;
}

// ============================================================================
// GameState 工厂 + 操作
// ============================================================================

export function createGameState(config: {
  gameId: string;
  playerOneId: string;
  playerTwoId: string;
  deck1: CardData[];
  deck2: CardData[];
}): GameState {
  const { gameId, playerOneId, playerTwoId, deck1, deck2 } = config;

  const p1State = buildInitialPlayerState(playerOneId, 'PlayerOne', deck1);
  const p2State = buildInitialPlayerState(playerTwoId, 'PlayerTwo', deck2);

  return {
    gameId,
    phase: 'Setup',
    turnNumber: 1,
    currentPlayerId: playerOneId,
    players: {
      [playerOneId]: p1State,
      [playerTwoId]: p2State,
    },
    battleState: null,
    stateVersion: 1,
    winner: null,
  };
}

function buildInitialPlayerState(
  playerId: string,
  order: 'PlayerOne' | 'PlayerTwo',
  deck: CardData[],
): PlayerState {
  // 1. 洗牌
  const shuffled = shuffle(deck);

  // 2. 创建 CardInZone 实例
  const deckInstances = toCardInZone(shuffled, playerId);

  // 3. 抽 7 张手牌
  const hand: CardInZone[] = [];
  for (let i = 0; i < 7; i++) {
    const card = deckInstances.pop();
    if (card) {
      hand.push({ ...card, faceUp: false });
    }
  }

  // 4. 从剩余卡组顶取 7 张放入生命区（背面）
  const lifeArea: CardInZone[] = [];
  for (let i = 0; i < 7; i++) {
    const card = deckInstances.pop();
    if (card) {
      lifeArea.push({ ...card, faceUp: false });
    }
  }

  // 5. AP 区（Turn 1 初始值）
  const apCount = getAPCount(order, 1);
  const apArea = createAPCards(playerId, apCount);

  return {
    playerId,
    playerOrder: order,
    deck: deckInstances,
    hand,
    frontLine: [],
    energyLine: [],
    lifeArea,
    apArea,
    sideline: [],
    removalArea: [],
    energyPool: {},
    availableAP: apCount,
  };
}

// ============================================================================
// 只读查询
// ============================================================================

export function getPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players[playerId];
}

export function getPhase(state: GameState): GamePhase {
  return state.phase;
}

export function getTurnNumber(state: GameState): number {
  return state.turnNumber;
}

export function getCurrentPlayerId(state: GameState): string {
  return state.currentPlayerId;
}

export function getWinner(state: GameState): string | null {
  return state.winner;
}

export function getOpponentId(state: GameState, playerId: string): string {
  for (const id of Object.keys(state.players)) {
    if (id !== playerId) return id;
  }
  throw new Error(`Opponent not found for player: ${playerId}`);
}

// ============================================================================
// 不可变状态更新
// ============================================================================

/**
 * 应用一组 StateChange，返回新的 GameState。
 * 所有变更原子性应用 — 任一变更失败则整个操作回滚（返回原 state）。
 */
export function applyChanges(state: GameState, changes: StateChange[]): GameState {
  let current = deepCloneState(state);

  for (const change of changes) {
    const result = applySingleChange(current, change);
    if (!result.success) {
      // 原子性：任一失败，返回原状态
      return state;
    }
    current = result.state;
  }

  // 更新版本号 + 重新计算缓存
  current.stateVersion = state.stateVersion + 1;
  current = recalculatePlayerCaches(current);

  return current;
}

interface ApplyResult {
  success: boolean;
  state: GameState;
}

function applySingleChange(state: GameState, change: StateChange): ApplyResult {
  switch (change.type) {
    case 'MOVE_CARD': {
      const { instanceId, from, to, playerId } = change;
      const player = state.players[playerId];
      if (!player) return { success: false, state };

      // 在源区域找到卡牌
      const fromZone = getZoneArray(player, from);
      const idx = fromZone.findIndex((c) => c.instanceId === instanceId);
      if (idx === -1) return { success: false, state };

      const [card] = fromZone.splice(idx, 1);

      // 转换 CardInZone → CardOnField（当移动到场上区域时）
      const isFieldZone = to === 'FrontLine' || to === 'EnergyLine' || to === 'ApArea';
      let movedCard: any = card;
      if (isFieldZone && !('state' in card)) {
        movedCard = {
          ...card,
          state: 'Resting' as const,
          currentBP: 0,
          raidedBy: null,
          raiding: null,
        };
      }

      const toZone = getZoneArray(player, to);
      toZone.push(movedCard);

      return { success: true, state: { ...state, players: { ...state.players, [playerId]: { ...player } } } };
    }

    case 'SET_FIELD_STATE': {
      const { instanceId, state: fieldState, playerId } = change;
      const player = state.players[playerId];
      if (!player) return { success: false, state };

      const card = findCardOnField(player, instanceId);
      if (!card) return { success: false, state };

      card.state = fieldState;
      return { success: true, state: { ...state, players: { ...state.players, [playerId]: { ...player } } } };
    }

    case 'UPDATE_BP': {
      const { instanceId, delta, playerId } = change;
      const player = state.players[playerId];
      if (!player) return { success: false, state };

      const card = findCardOnField(player, instanceId);
      if (!card) return { success: false, state };

      card.currentBP += delta;
      return { success: true, state: { ...state, players: { ...state.players, [playerId]: { ...player } } } };
    }

    case 'ADJUST_AP': {
      const { playerId, delta } = change;
      const player = state.players[playerId];
      if (!player) return { success: false, state };

      if (delta > 0) {
        // 增加 AP 卡
        const newAPs = createAPCards(playerId, delta);
        player.apArea.push(...newAPs);
      } else if (delta < 0) {
        // 减少 AP 卡（从 Active 的开始移除）
        const toRemove = Math.abs(delta);
        let removed = 0;
        for (let i = player.apArea.length - 1; i >= 0 && removed < toRemove; i--) {
          player.apArea.splice(i, 1);
          removed++;
        }
      }

      return { success: true, state: { ...state, players: { ...state.players, [playerId]: { ...player } } } };
    }

    case 'DRAW_CARD': {
      const { playerId, count } = change;
      const player = state.players[playerId];
      if (!player) return { success: false, state };

      for (let i = 0; i < count; i++) {
        const card = player.deck.pop();
        if (!card) return { success: false, state }; // 牌库空
        player.hand.push({ ...card, faceUp: false });
      }

      return { success: true, state: { ...state, players: { ...state.players, [playerId]: { ...player } } } };
    }

    case 'SHUFFLE_DECK': {
      const { playerId } = change;
      const player = state.players[playerId];
      if (!player) return { success: false, state };

      const cards: CardData[] = []; // We don't have CardData refs here, just shuffle instances
      // Simply shuffle the CardInZone array
      const shuffled = shuffle(player.deck);
      player.deck.length = 0;
      player.deck.push(...shuffled);

      return { success: true, state: { ...state, players: { ...state.players, [playerId]: { ...player } } } };
    }

    default:
      return { success: false, state };
  }
}

// ============================================================================
// 内部辅助
// ============================================================================

function getZoneArray(player: PlayerState, zone: string): CardInZone[] {
  switch (zone) {
    case 'Deck':       return player.deck;
    case 'Hand':       return player.hand;
    case 'FrontLine':  return player.frontLine;
    case 'EnergyLine': return player.energyLine;
    case 'LifeArea':   return player.lifeArea;
    case 'ApArea':     return player.apArea;
    case 'Sideline':   return player.sideline;
    case 'RemovalArea': return player.removalArea;
    default:           throw new Error(`Unknown zone: ${zone}`);
  }
}

function findCardOnField(player: PlayerState, instanceId: string): CardOnField | null {
  for (const zone of [player.frontLine, player.energyLine, player.apArea]) {
    const found = zone.find((c) => c.instanceId === instanceId);
    if (found) return found;
  }
  return null;
}

function deepCloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

/**
 * 重新计算玩家缓存值（energyPool, availableAP）。
 * 每次 applyChanges 后自动调用。
 */
function recalculatePlayerCaches(state: GameState): GameState {
  const newPlayers: Record<string, PlayerState> = {};

  for (const [playerId, player] of Object.entries(state.players)) {
    // 能量池：汇总能量线上所有卡的能量生成
    const energyPool: Record<string, number> = {};
    for (const card of player.energyLine) {
      // 从 CardData 获取 energyGeneration（运行时通过 cardId 关联）
      // B1 阶段暂不处理 hasPlus (RQ-005) — 留到 B2 EnergySystem
      // 此处只做基础汇总
    }

    // 可用 AP：AP 区中 Active 状态的数量
    const availableAP = player.apArea.filter((ap) => ap.state === 'Active').length;

    newPlayers[playerId] = {
      ...player,
      energyPool,
      availableAP,
    };
  }

  return { ...state, players: newPlayers };
}
