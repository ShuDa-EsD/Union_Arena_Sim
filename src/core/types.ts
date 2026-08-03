// ============================================================================
// Union Arena Digital — Core Types
// ============================================================================
// Batch 0: 只定义 B0-B1 实际使用的类型。后续 Batch 在需要时增量添加。
// 参考：Architecture.md §3 / Card_System.md §2-§4 / Game_Design.md
// ============================================================================

// ===== 卡牌基础 =====
export type CardType = 'Character' | 'Site' | 'Event' | 'AP';

// ===== 游戏阶段 =====
export type GamePhase =
  | 'Setup'
  | 'Start'
  | 'Movement'
  | 'Main'
  | 'Attack'
  | 'End'
  | 'GameOver';

// ===== 区域 =====
export type Zone =
  | 'Deck'
  | 'Hand'
  | 'FrontLine'
  | 'EnergyLine'
  | 'LifeArea'
  | 'ApArea'
  | 'Sideline'
  | 'RemovalArea';

// ===== 场上状态 =====
export type FieldState = 'Active' | 'Resting';

// ===== 事件类型 =====
export type GameEventType =
  | 'GameStarted'
  | 'TurnStarted'
  | 'PhaseChanged'
  | 'TurnEnded'
  | 'GameEnded'
  | 'CardPlayed'
  | 'CardSidelined'
  | 'CardMovedToZone'
  | 'AttackDeclared'
  | 'BlockDeclared'
  | 'BattleResolved'
  | 'BattleWon'
  | 'BattleLost'
  | 'DamageDealt'
  | 'LifeCardRevealed'
  | 'TriggerChecked'
  | 'TriggerActivated'
  | 'AbilityActivated'
  | 'AbilityResolved'
  | 'StateChanged';

// ===== 卡牌数据（来自 JSON） =====

export interface AbilityData {
  abilityId: string;
  timing: string; // 如 "WhenPlayed" / "ActivateMain" 等
  condition?: Record<string, any>; // 条件（可选）
  costs: Array<{ costType: string; params?: Record<string, any> }>;
  effects: Array<{ effectType: string; params?: Record<string, any> }>;
  isOptional: boolean;
}

export interface RaidData {
  targetSpecifier: { type: 'Name' | 'Affinity'; value: string };
  raidAbilities: AbilityData[]; // RQ-004: 分离存储
}

export interface CardData {
  cardId: string;
  cardName: string;
  cardType: CardType;
  sourceMaterial: string; // 来源材料代码，如 "HTR"（卡组构筑 + Raid Affinity 匹配）
  affinities: string[]; // 属性标签，如 ["Hunter", "Protagonist"]（Raid 匹配 + 能力条件）
  requiredEnergy: { color: string; amount: number };
  apCost: number;
  bp?: { base: number }; // Character 专属
  energyGeneration?: Array<{ color: string; amount: number }>; // Character/Site 专属
  abilities: AbilityData[]; // 显式能力列表（B1-B4 不使用关键词）
  trigger?: AbilityData; // Trigger 能力
  raid?: RaidData; // Raid 数据
  keywords: string[]; // 关键词标记（B1-B4 留空，B5 启用）
}

// ===== 运行时状态 =====

export interface CardInZone {
  cardId: string; // 指向 CardData.cardId
  instanceId: string; // 运行时唯一 ID
  ownerId: string;
  faceUp: boolean;
}

export interface CardOnField extends CardInZone {
  state: FieldState;
  currentBP: number;
  raidedBy: string | null;
  raiding: string | null;
}

export interface PlayerState {
  playerId: string;
  playerOrder: 'PlayerOne' | 'PlayerTwo';
  deck: CardInZone[];
  hand: CardInZone[];
  frontLine: CardOnField[];
  energyLine: CardOnField[];
  lifeArea: CardInZone[];
  apArea: CardOnField[]; // AP 卡复用 CardOnField
  sideline: CardInZone[];
  removalArea: CardInZone[];
  energyPool: Record<string, number>;
  availableAP: number;
}

export interface GameState {
  gameId: string;
  phase: GamePhase;
  turnNumber: number;
  currentPlayerId: string;
  players: Record<string, PlayerState>;
  battleState: BattleState | null;
  stateVersion: number;
  winner: string | null;
}

// ===== 事件 =====

export interface GameEvent {
  eventType: GameEventType;
  sourcePlayerId?: string;
  sourceCardInstanceId?: string;
  data: Record<string, any>;
}

// ===== 操作 =====

export type ActionType =
  | 'PlayCharacter'
  | 'PlaySite'
  | 'UseEvent'
  | 'PerformRaid'
  | 'ActivateAbility'
  | 'MoveCharacter'
  | 'DeclareAttack'
  | 'DeclareBlock'
  | 'ActivateTrigger'
  | 'ExtraDraw'
  | 'EndMainPhase'
  | 'EndAttackPhase'
  | 'MulliganDecision';

export interface ActionRequest {
  actionType: ActionType;
  playerId: string;
  cardInstanceId?: string;
  targetInstanceId?: string;
  targetZone?: Zone;
  abilityId?: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  newState: GameState;
  events: GameEvent[];
  log: string[];
}

// ===== 卡牌注册表 =====

export interface CardRegistry {
  byId: Map<string, CardData>;
  all: CardData[];
}

export interface AbilityInstance {
  instanceId: string;                    // 队列中的唯一ID
  abilityData: AbilityData;
  sourceCardInstanceId: string;          // 来源卡牌运行时实例
  sourcePlayerId: string;
  isTrigger: boolean;                    // 是否来自 Trigger
}

// ===== 战斗状态 (B4) =====

export type BattleStep = 'Idle' | 'AttackerDeclaration' | 'BlockerDeclaration' | 'Resolving' | 'Ending';

export interface BattleState {
  step: BattleStep;
  attacker: {
    cardInstanceId: string;
    bpAtDeclaration: number;
  };
  target: {
    type: 'Player' | 'Character';
    playerId: string;
    characterInstanceId?: string;
  };
  blocker: {
    cardInstanceId: string;
    bpAtDeclaration: number;
  } | null;
  isSnipe: boolean;
  damageDealt: number;
}

// ===== 状态变更（B1 最小集 — 覆盖 Batch 1-2 的 GameState 更新需求） =====
// B3+ 按需扩展新的 change type

export type StateChange =
  | { type: 'MOVE_CARD'; instanceId: string; from: Zone; to: Zone; playerId: string }
  | { type: 'SET_FIELD_STATE'; instanceId: string; state: FieldState; playerId: string }
  | { type: 'UPDATE_BP'; instanceId: string; delta: number; playerId: string }
  | { type: 'ADJUST_AP'; playerId: string; delta: number }
  | { type: 'DRAW_CARD'; playerId: string; count: number }
  | { type: 'SHUFFLE_DECK'; playerId: string };
