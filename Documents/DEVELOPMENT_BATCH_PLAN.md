# Union Arena Digital — Development Batch Plan

> 版本：2.0
> 创建日期：2026-08-03
> 最后更新：2026-08-04
> 审核意见：降低初期复杂度 / 关键词分流 / 增加人工确认 / 减少初始卡牌 / 架构不变
>
> 基于：MVP_IMPLEMENTATION_PLAN.md

---

## 目录

1. [总览](#总览)
2. [Batch 0：项目骨架 + 核心类型 + 极简 EventBus](#batch-0项目骨架--核心类型--极简-eventbus)
3. [Batch 1：卡牌加载 + GameState + 首批 8 张测试卡](#batch-1卡牌加载--gamestate--首批-8-张测试卡)
4. [Batch 2：回合流转 + 能量 + 移动 + 规则验证](#batch-2回合流转--能量--移动--规则验证)
5. [Batch 3：打出卡牌 + 基础能力结算](#batch-3打出卡牌--基础能力结算)
6. [Batch 4：战斗系统 + 伤害 + Trigger](#batch-4战斗系统--伤害--trigger)
7. [Batch 5：Raid + 关键词系统 + 卡牌补全](#batch-5raid--关键词系统--卡牌补全)
8. [Batch 6：GameEngine 集成 + 场景脚本 + 端到端测试](#batch-6gameengine-集成--场景脚本--端到端测试)

---

## 总览

### 批次一览

```
Batch 0  █░░░░░░░░░░░░░  骨架 + 类型     ~0.5天   项目能编译，核心类型就绪
Batch 1  ███░░░░░░░░░░░  卡牌 + 状态     ~1-2天   能加载卡牌、创建初始游戏状态
Batch 2  █████░░░░░░░░░  回合 + 资源     ~1-2天   能空转回合（不打出卡牌）
Batch 3  ████████░░░░░░  打牌 + 能力     ~2-3天   能打出卡牌、发动能力  ← 首次可交互
Batch 4  ████████████░░  战斗 + 触发     ~2-3天   能攻击、BP结算、Trigger  ← 可玩！
Batch 5  ██████████████  Raid + 关键词   ~1-2天   全部机制就绪
Batch 6  ████████████████ 集成 + 测试    ~1-2天   一键运行完整对局  ← MVP完成
         ──────────────
         合计约 9-15 天
```

### 可玩性里程碑

| Batch | 能做什么 |
|-------|---------|
| B0 | `npm test` 通过，TypeScript 编译零错误 |
| B1 | 加载卡牌 JSON → 创建游戏 → console.log 手牌/卡组/生命区 |
| B2 | 自动走完整回合（Start→Movement→Main→End），输出每阶段状态 |
| B3 | **打出卡牌**：手牌减少，场上出现角色，When Played 触发抽牌 |
| B4 | **完整对局可玩**：攻击→阻挡→BP结算→翻生命卡→Trigger→胜负判定 |
| B5 | Raid 堆叠 + 全部关键词生效 |
| B6 | `npm run scenario basic_game` 一键自动运行到一方胜利 |

### 审核调整说明

| # | 审核意见 | 调整方式 |
|---|---------|---------|
| 1 | 降低 Batch 0 初期复杂度 | 移除 JSON Schema / 关键词定义 / Logger / 泛型 EventBus 优先级；types.ts 只写当前 Batch 必需的 |
| 2 | 关键词系统分流 | B1-B4：卡牌能力用**显式 JSON** 手写（不用关键词）；B5：统一添加关键词展开系统 |
| 3 | 增加人工确认流程 | 每个 Batch 末尾增加「✅ 人工确认清单」— 含运行命令、预期输出、签字栏 |
| 4 | 减少 Demo Card Set 初始规模 | B1 只写 8 张基础卡 → B3 +4 → B4 +4 → B5 +4（共 20 张，渐进添加） |
| 5 | 保持整体架构不变 | 模块划分、依赖关系、数据流设计与原 Architecture.md 一致，仅调整开发节奏 |

---

## Batch 0：项目骨架 + 核心类型 + 极简 EventBus

### 目标

搭建 Node.js/TypeScript 项目，定义**本 Batch 必需**的类型，实现最简单可用的 EventBus。

### 设计原则

> **只做「后续 Batch 立刻需要」的事。**不做超前设计。

### 完成标准

- [ ] `npm install && npm test` 成功运行
- [ ] `npx tsc --noEmit` 零错误
- [ ] EventBus 可 `on()` 订阅 + `emit()` 发布（同步、无优先级）
- [ ] `shuffle()` 和 `generateInstanceId()` 可正常工作
- [ ] 1 个占位单元测试通过

### 具体任务

#### B0.1 — 项目初始化

```bash
npm init -y
npm install typescript jest ts-jest @types/jest --save-dev
npx tsc --init
```

`tsconfig.json` 关键配置：
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

`jest.config.js`：
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
};
```

#### B0.2 — 核心类型（仅本 Batch 必需）

文件：`src/core/types.ts`

> **原则**：只定义 B0-B1 实际使用的类型。后续 Batch 在需要时增量添加。

本 Batch 定义以下类型：

```typescript
// ===== 卡牌基础 =====
type CardType = 'Character' | 'Site' | 'Event' | 'AP';

// ===== 游戏阶段 =====
type GamePhase = 'Setup' | 'Start' | 'Movement' | 'Main' | 'Attack' | 'End' | 'GameOver';

// ===== 区域 =====
type Zone = 'Deck' | 'Hand' | 'FrontLine' | 'EnergyLine' | 'LifeArea' | 'ApArea' | 'Sideline' | 'RemovalArea';

// ===== 场上状态 =====
type FieldState = 'Active' | 'Resting';

// ===== 事件 =====
type GameEventType =
  | 'GameStarted' | 'TurnStarted' | 'PhaseChanged' | 'TurnEnded' | 'GameEnded'
  | 'CardPlayed' | 'CardSidelined' | 'CardMovedToZone'
  | 'AttackDeclared' | 'BlockDeclared' | 'BattleResolved' | 'BattleWon' | 'BattleLost'
  | 'DamageDealt' | 'LifeCardRevealed' | 'TriggerChecked' | 'TriggerActivated'
  | 'AbilityActivated' | 'AbilityResolved'
  | 'StateChanged';

// ===== 卡牌数据（来自 JSON） =====
interface CardData {
  cardId: string;
  cardName: string;
  cardType: CardType;
  requiredEnergy: { color: string; amount: number };
  apCost: number;
  bp?: { base: number };              // Character 专属
  energyGeneration?: Array<{ color: string; amount: number }>;  // Character/Site 专属
  abilities: AbilityData[];            // 显式能力列表（B1-B4 不使用关键词）
  trigger?: AbilityData;               // Trigger 能力
  raid?: RaidData;                     // Raid 数据
  keywords: string[];                  // 关键词标记（B1-B4 留空，B5 启用）
}

interface AbilityData {
  abilityId: string;
  timing: string;                      // 如 "WhenPlayed" / "ActivateMain" 等
  condition?: Record<string, any>;     // 条件（可选）
  costs: Array<{ costType: string; params?: Record<string, any> }>;
  effects: Array<{ effectType: string; params?: Record<string, any> }>;
  isOptional: boolean;
}

interface RaidData {
  targetSpecifier: { type: 'Name' | 'Affinity'; value: string };
  raidAbilities: AbilityData[];        // RQ-004: 分离存储
}

// ===== 运行时状态 =====
interface CardInZone {
  cardId: string;                      // 指向 CardData.cardId
  instanceId: string;                  // 运行时唯一 ID
  ownerId: string;
  faceUp: boolean;
}

interface CardOnField extends CardInZone {
  state: FieldState;
  currentBP: number;
  raidedBy: string | null;
  raiding: string | null;
}

interface PlayerState {
  playerId: string;
  playerOrder: 'PlayerOne' | 'PlayerTwo';
  deck: CardInZone[];
  hand: CardInZone[];
  frontLine: CardOnField[];
  energyLine: CardOnField[];
  lifeArea: CardInZone[];
  apArea: CardOnField[];               // AP 卡复用 CardOnField
  sideline: CardInZone[];
  removalArea: CardInZone[];
  energyPool: Record<string, number>;
  availableAP: number;
}

interface GameState {
  gameId: string;
  phase: GamePhase;
  turnNumber: number;
  currentPlayerId: string;
  players: Record<string, PlayerState>;
  battleState: null;                   // B4 前始终为 null
  stateVersion: number;
  winner: string | null;
}

// ===== 事件 =====
interface GameEvent {
  eventType: GameEventType;
  sourcePlayerId?: string;
  sourceCardInstanceId?: string;
  data: Record<string, any>;
}

// ===== 操作 =====
type ActionType =
  | 'PlayCharacter' | 'PlaySite' | 'UseEvent'
  | 'PerformRaid' | 'ActivateAbility'
  | 'MoveCharacter'
  | 'DeclareAttack' | 'DeclareBlock' | 'ActivateTrigger'
  | 'ExtraDraw' | 'EndMainPhase' | 'EndAttackPhase'
  | 'MulliganDecision';

interface ActionRequest {
  actionType: ActionType;
  playerId: string;
  cardInstanceId?: string;
  targetInstanceId?: string;
  targetZone?: Zone;
  abilityId?: string;
}

interface ActionResult {
  success: boolean;
  error?: string;
  newState: GameState;
  events: GameEvent[];
  log: string[];
}

// ===== 卡牌注册表 =====
interface CardRegistry {
  byId: Map<string, CardData>;
  all: CardData[];
}
```

> **注意**：上述类型中，`AbilityTiming` / `EffectType` / `ConditionType` / `CostType` 等枚举不在 B0 定义。它们在使用 `string` 宽松类型，在需要严格枚举的 Batch（B3+）中再收紧。这避免了 B0 定义"未来可能用不上"的枚举值。

#### B0.3 — 极简 EventBus

文件：`src/core/EventBus.ts`

```typescript
type EventHandler = (event: GameEvent) => void;

class EventBus {
  private handlers: Map<GameEventType, EventHandler[]> = new Map();

  on(eventType: GameEventType, handler: EventHandler): void {
    // 注册处理器
  }

  emit(event: GameEvent): void {
    // 同步调用所有已注册的处理器
  }

  clear(): void {
    // 清空所有处理器
  }
}
```

> **注意**：B0 的 EventBus **不实现** `off()` 和优先级排序。MVP 阶段处理器注册后不会取消；优先级在 B3 的 AbilityQueue 中独立管理，不需要 EventBus 层面支持。

#### B0.4 — 工具函数

| 文件 | 函数 | 说明 |
|------|------|------|
| `src/utils/shuffle.ts` | `shuffle<T>(arr: T[]): T[]` | Fisher-Yates 洗牌，返回新数组 |
| `src/utils/idgen.ts` | `generateInstanceId(): string` | 格式 `inst-{counter}-{random4hex}` |

> **不实现**：Logger（B0-B2 直接用 `console.log`，B3+ 如需要再加）。

### 测试方法

| 测试 | 验证点 |
|------|--------|
| `EventBus.test.ts` | `on()` 注册 → `emit()` 触发 → handler 收到正确 event |
| `shuffle.test.ts` | 输出长度相同、元素不丢失 |
| `idgen.test.ts` | 连续 1000 次调用无重复 |

### 影响文件

```
新增 (8个):
  package.json
  tsconfig.json
  jest.config.js
  src/core/types.ts
  src/core/EventBus.ts
  src/utils/shuffle.ts
  src/utils/idgen.ts
  tests/core/EventBus.test.ts          (含 1 个占位测试 + EventBus 测试)
```

---

### ✅ Batch 0 人工确认清单

在进入 Batch 1 之前，请逐项确认：

```
[ ] 1. 运行 `npm install` 无错误
[ ] 2. 运行 `npx tsc --noEmit` 零类型错误
[ ] 3. 运行 `npm test` 全部测试通过（至少 EventBus + shuffle + idgen）
[ ] 4. 打开 src/core/types.ts，确认 CardData / PlayerState / GameState 三个接口字段
       与 Architecture.md §3 一致（现阶段不需要全部字段，但结构要对）
[ ] 5. 在脑海中模拟：用现有类型能否描述"一个玩家 + 8张手牌 + 1张角色在前线"？

签字：___________  日期：___________
```

---

## Batch 1：卡牌加载 + GameState + 首批 8 张测试卡

### 目标

实现 CardSystem（加载 + 验证）和 GameState（初始化 + 不可变更新 + 只读查询）。能够从 JSON 文件加载卡牌并创建完整的初始游戏状态。

### 设计原则

> **能力用显式 JSON 手写，暂不使用关键词展开。**

### 完成标准

- [ ] `CardSystem.loadCardsFromDirectory()` 加载 8 张测试卡 JSON，返回 `CardData[]`
- [ ] `CardSystem.validateCard()` 检查必填字段（cardId / cardType / requiredEnergy / apCost）
- [ ] `CardSystem.createRegistry()` 构建 `CardRegistry`，支持 `byId` 查询
- [ ] `GameState.create()` 创建完整初始状态：卡组 50 张(已洗牌)、手牌 7 张、生命区 7 张、AP 区正确
- [ ] 状态不可变：每次更新返回新 `GameState`，旧对象不变
- [ ] 8 张测试卡 JSON 全部通过验证

### 具体任务

#### B1.1 — CardSystem

文件：`src/systems/CardSystem.ts`

```typescript
class CardSystem {
  // 从目录加载所有 .json 文件
  static loadCardsFromDirectory(dirPath: string): CardData[];

  // 验证单张卡牌数据
  static validateCard(card: CardData): { valid: boolean; errors: string[] };
  // 检查：cardId 非空、cardType 有效、requiredEnergy 格式正确、
  //       Character 必须有 bp、Site/Character 在能量线时有 energyGeneration

  // 构建注册表
  static createRegistry(cards: CardData[]): CardRegistry;
}
```

> **注意**：B1 的 CardSystem **不实现**关键词展开（`expandKeywords`）。卡牌 JSON 中的 `abilities[]` 直接使用，引擎原样读取。关键词展开在 B5 加入。

#### B1.2 — GameState

文件：`src/core/GameState.ts`

```typescript
class GameState {
  // 工厂方法：创建初始游戏状态
  static create(config: {
    gameId: string;
    playerOneId: string;
    playerTwoId: string;
    deck1: CardData[];   // 玩家1的50张卡
    deck2: CardData[];   // 玩家2的50张卡
  }): GameState;

  // 只读查询
  getPlayer(playerId: string): PlayerState;
  getPhase(): GamePhase;
  getTurnNumber(): number;
  getCurrentPlayerId(): string;
  getWinner(): string | null;

  // 不可变更新
  applyChanges(changes: StateChange[]): GameState;

  // 内部辅助
  private static buildPlayerState(playerId: string, order: 'PlayerOne' | 'PlayerTwo',
                                   deck: CardData[], turnNumber: number): PlayerState;
}
```

初始化流程（`GameState.create`）：
```
1. shuffle(player1Deck) + shuffle(player2Deck)
2. 各从牌库顶取 7 张 → hand
3. 各从牌库顶取 7 张 → lifeArea（背面）
4. AP 区按 AP 表放置：
   - PlayerOne (先手): 1 张 AP (Active)
   - PlayerTwo (后手): 2 张 AP (Active)
5. 设置 turnNumber=1, currentPlayerId=PlayerOne, phase=Start
6. 计算初始 energyPool (空) 和 availableAP
```

`StateChange` 类型（B1 定义）：
```typescript
interface StateChange {
  type: 'MOVE_CARD' | 'SET_FIELD_STATE' | 'UPDATE_BP' | 'ADJUST_AP' | 'DRAW_CARD' | 'SHUFFLE_DECK';
  instanceId?: string;
  from?: Zone;
  to?: Zone;
  playerId?: string;
  state?: FieldState;
  bpDelta?: number;
  count?: number;
}
```

#### B1.3 — 首批 8 张测试卡

目录：`src/data/cards/test_set/`

> **B1 只创建 8 张基础卡。能力用显式 JSON 手写，不使用关键词。**

| # | cardId | 类型 | BP | 能量需求 | 能力 | 测试目的 |
|---|--------|------|-----|---------|------|---------|
| 1 | `HTR-1-001` | Character | 3000 | 白×1 | 无 | 无能力角色（香草） |
| 2 | `HTR-1-002` | Character | 4000 | 白×1 | 无 | 不同 BP 的香草角色 |
| 3 | `HTR-1-003` | Character | 2000 | 白×2 | 无 | 高费用香草角色 |
| 4 | `HTR-1-004` | Character | 5000 | 白×2 | 无 | 高 BP 高费用角色 |
| 5 | `HTR-1-005` | Site | — | 白×1 | 无 | 基础能量来源 |
| 6 | `HTR-1-006` | Event | — | 白×1 | 效果: Draw 1 card | 基础事件卡 |
| 7 | `HTR-1-007` | Character | 3000 | 白×1 | WhenPlayed: Draw 1 | 入场抽牌角色 |
| 8 | `HTR-1-008` | Character | 3500 | 白×2 | WhenPlayed: Draw 1 | 高费入场抽牌角色 |

**能力 JSON 示例**（HTR-1-007）：
```json
{
  "cardId": "HTR-1-007",
  "cardName": "Test Char 7",
  "cardType": "Character",
  "requiredEnergy": { "color": "白", "amount": 1 },
  "apCost": 1,
  "bp": { "base": 3000 },
  "energyGeneration": [{ "color": "白", "amount": 1 }],
  "abilities": [
    {
      "abilityId": "HTR-1-007-ABL-1",
      "timing": "WhenPlayed",
      "costs": [],
      "effects": [
        { "effectType": "DrawCard", "params": { "count": 1 } }
      ],
      "isOptional": false
    }
  ],
  "keywords": []
}
```

> 所有 8 张卡均使用**显式能力 JSON**。`keywords` 字段留空数组。不依赖关键词展开系统。

#### B1.4 — 测试辅助工厂

文件：`tests/fixtures/test_cards.ts`

```typescript
// 工厂函数：快速创建测试用 CardData（不读磁盘）
function createTestCharacter(overrides: Partial<CardData>): CardData;
function createTestSite(overrides: Partial<CardData>): CardData;
function createTestEvent(overrides: Partial<CardData>): CardData;
function createTestDeck(cardIds: string[], registry: CardRegistry): CardData[];
```

文件：`tests/fixtures/test_state.ts`

```typescript
// 工厂函数：快速创建测试用 GameState
function createTestGameState(overrides?: Partial<GameState>): GameState;
```

### 测试方法

| 测试 | 验证点 |
|------|--------|
| 加载 8 张 JSON 卡牌 | 全部返回，cardId 正确 |
| 验证：缺少 cardId → 报错 | validateCard 返回 errors |
| 验证：Character 缺 bp → 报错 | 类型约束 |
| CardRegistry.byId 查询 | O(1) 查找 |
| GameState.create 初始化 | 卡组 50 张、手牌 7、生命 7、AP: P1=1 P2=2 |
| 不可变更新 | 旧 state 的 hand 数组不变 |
| 洗牌 | shuffle 后顺序改变，元素不变 |

### 影响文件

```
新增 (16个):
  src/systems/CardSystem.ts
  src/core/GameState.ts
  src/data/cards/test_set/HTR-1-001.json ~ HTR-1-008.json  (8个文件)
  tests/systems/CardSystem.test.ts
  tests/core/GameState.test.ts
  tests/fixtures/test_cards.ts
  tests/fixtures/test_state.ts

修改 (1个):
  src/core/types.ts  (补充 StateChange 类型)
```

---

### ✅ Batch 1 人工确认清单

在进入 Batch 2 之前，请逐项确认：

```
[ ] 1. 运行 `npm test` 全部测试通过（CardSystem + GameState）
[ ] 2. 编写临时脚本或使用 Node REPL：
       - 加载 8 张卡 → 打印 CardRegistry.all 卡名列表
       - 创建 GameState → 打印双方 hand.length / deck.length / lifeArea.length
[ ] 3. 确认：PlayerOne hand=7, deck=43, lifeArea=7, apArea=1(Active)
        PlayerTwo hand=7, deck=43, lifeArea=7, apArea=2(Active)
[ ] 4. 确认：GameState.applyChanges() 返回新对象，旧对象字段未变
[ ] 5. 检查 HTR-1-007.json：abilities[0].timing="WhenPlayed"，
       abilities[0].effects[0].effectType="DrawCard" — JSON 格式正确、
       不需要任何引擎展开即可被 B3 使用
[ ] 6. 尝试在脑海中模拟 B2 的 TurnManager：
       用 GameState.create() 产出的状态 → 读取 phase="Start" → 
       执行 Start Phase 动作 → 状态变为 phase="Movement" — 现有数据结构能否支撑？

签字：___________  日期：___________
```

---

## Batch 2：回合流转 + 能量 + 移动 + 规则验证

### 目标

实现 TurnManager（5 阶段状态机）、EnergySystem（能量汇总 + canAfford）、MovementSystem（移动管理）和 RuleValidator（阶段权限）。达成 **M1：空转回合**。

### 完成标准

- [ ] 5 阶段正确流转：Start → Movement → Main → Attack → End
- [ ] Start Phase 自动动作：清除效果(空转时无效果) → Active 切换 → AP 调整 → 抽牌
- [ ] Player One Turn 1 跳过 Attack Phase（RQ-008）
- [ ] End Phase：Active 切换 → 手牌上限检查（>8 张弃牌）
- [ ] EnergySystem 正确汇总能量线（按颜色），`canAfford()` 正确判断
- [ ] MovementSystem 处理能量线→前线移动 + 容量超限
- [ ] RuleValidator 检查阶段权限（如：不能在 Movement Phase 打牌）
- [ ] **空转回合演示**：P1 Turn1 → P2 Turn1 → P1 Turn2，输出每阶段状态

### 具体任务

#### B2.1 — TurnManager

文件：`src/core/TurnManager.ts`

```typescript
class TurnManager {
  constructor(private eventBus: EventBus) {}

  // 推进到下一阶段，返回 StateChange 列表
  advancePhase(state: GameState): { changes: StateChange[]; events: GameEvent[] };

  // 各阶段自动执行
  private executeStartPhase(state: GameState): { changes: StateChange[]; events: GameEvent[] };
  private executeEndPhase(state: GameState): { changes: StateChange[]; events: GameEvent[] };

  // 查询
  getNextPhase(currentPhase: GamePhase, state: GameState): GamePhase;
}
```

阶段流转逻辑：
```
Start     → (自动) → Movement
Movement  → (自动) → Main
Main      → (玩家选择) → Attack 或 End
Attack    → (玩家选择结束) → End
End       → (自动) → 切换玩家 → 对手的 Start
```

⚠️ RQ-008：
```typescript
// TurnManager.getNextPhase 中
if (state.turnNumber === 1 && state.currentPlayerId === playerOneId && phase === 'Main') {
  return 'End';  // 跳过 Attack
}
```

#### B2.2 — EnergySystem

文件：`src/systems/EnergySystem.ts`

```typescript
class EnergySystem {
  // 计算某玩家的当前能量池（按颜色）
  calculateEnergy(state: GameState, playerId: string): Record<string, number>;

  // 判断能否支付某张卡的 energy 需求
  canAfford(state: GameState, playerId: string, card: CardData): boolean;
}
```

#### B2.3 — MovementSystem

文件：`src/systems/MovementSystem.ts`

```typescript
class MovementSystem {
  // 验证移动合法性
  canMove(state: GameState, playerId: string, instanceId: string,
          from: Zone, to: Zone): { valid: boolean; error?: string };

  // 执行移动 + 容量处理
  moveCharacter(state: GameState, playerId: string, instanceId: string,
                from: Zone, to: Zone): StateChange[];
}
```

#### B2.4 — RuleValidator

文件：`src/core/RuleValidator.ts`

```typescript
class RuleValidator {
  // 阶段权限矩阵
  isActionAllowedInPhase(action: ActionType, phase: GamePhase): boolean;

  // 能量检查
  canPayEnergy(state: GameState, playerId: string, card: CardData): boolean;

  // AP 检查
  canPayAP(state: GameState, playerId: string, apCost: number): boolean;

  // 区域容量检查
  canPlaceInZone(state: GameState, playerId: string, zone: Zone): boolean;
}
```

> **注意**：B2 的 RuleValidator 只实现阶段权限 + 能量 + AP + 容量。目标选择、状态条件等验证在 B3+ 按需添加。

### 测试方法

| 测试 | 验证点 |
|------|--------|
| 5 阶段顺序流转 | Start→Movement→Main→Attack→End |
| P1 Turn1: Main→End（无 Attack） | RQ-008 |
| P2 Turn1: Main→Attack→End | 正常流程 |
| AP 表：P1 T1=1 / P2 T1=2 / T3=3 | 数值正确 |
| Start Phase 抽牌 | 手牌+1, 卡组-1 |
| 先手 T1 Start 不抽牌 | 手牌不变 |
| End Phase 手牌上限（>8→弃牌） | 保留 8 张，其余进 Removal |
| 能量汇总（同色/异色） | 颜色合并正确 |
| canAfford 成功/数量不足/颜色错 | 三种情况 |
| 前线卡不参与能量计算 | 区域过滤 |
| 能量线→前线移动 | 区域变更 |
| 容量超限（满 4 张） | 移除目标线 1 张 |
| 阶段权限：Movement Phase 不能打牌 | RuleValidator 拒绝 |

### 影响文件

```
新增 (6个):
  src/core/TurnManager.ts
  src/systems/EnergySystem.ts
  src/systems/MovementSystem.ts
  src/core/RuleValidator.ts
  tests/core/TurnManager.test.ts
  tests/systems/EnergySystem.test.ts
  tests/systems/MovementSystem.test.ts
  tests/core/RuleValidator.test.ts

修改 (3个):
  src/core/types.ts       (补充 TurnInfo 等)
  src/core/EventBus.ts    (补充 TURN_STARTED / PHASE_CHANGED 等事件)
  src/core/GameState.ts   (补充 updateAP / handLimitCheck 等方法)
```

---

### ✅ Batch 2 人工确认清单

在进入 Batch 3 之前，请逐项确认：

```
[ ] 1. 运行 `npm test` 全部测试通过（含 B2 新增的 4 个测试文件）
[ ] 2. 编写临时脚本，执行以下空转回合并观察 console.log 输出：
       Turn 1 (PlayerOne, 先手):
         Start Phase → Movement Phase(跳过移动) → Main Phase(跳过打牌) → End Phase
       Turn 2 (PlayerTwo):
         Start Phase → Movement Phase → Main Phase → Attack Phase(无攻击者→立即结束) → End Phase
[ ] 3. 确认 Turn 1: P1 手牌从 7 变成 7（先手 T1 不抽牌），P1 AP=1(Active)
        Turn 2: P2 手牌从 7 变成 8（抽了 1 张），P2 AP=2(Active)
[ ] 4. 确认 Turn 1 输出中没有 "Attack Phase" 字样（RQ-008 生效）
        Turn 2 输出中有 "Attack Phase" 字样
[ ] 5. 在 Movement Phase 尝试移动 1 张能量线角色到前线 → 确认区域变更正确

签字：___________  日期：___________
```

---

## Batch 3：打出卡牌 + 基础能力结算

### 目标

实现 ActionSystem 和 AbilitySystem 的核心部分。可以在 Main Phase 打出卡牌，并正确结算 **When Played** 和 **Activate: Main** 两种能力。**首次达到可交互状态。**

### 完成标准

- [ ] ActionSystem 接收操作 → RuleValidator 验证 → 执行 → 更新 GameState → 返回 ActionResult
- [ ] 打出角色卡到前线/能量线（能量检查 + AP 支付 + Resting 状态）
- [ ] 打出 Site 卡到能量线
- [ ] 使用 Event 卡（结算效果 → 进 Sideline）
- [ ] **When Played 能力**：打出卡牌 → CARD_PLAYED 事件 → 匹配 WhenPlayed → 条件评估 → 效果执行
- [ ] **Activate: Main 能力**：手动指定卡牌+能力 → 代价支付 → 效果执行
- [ ] 效果执行器支持 **MVP 最小效果集**：DrawCard / BPBuff / SwitchToActive / SwitchToResting / SidelineCharacter / Sequence
- [ ] 条件评估器支持：IfOnFrontLine / IfActive / IfOpponentHasCharacter

### 具体任务

#### B3.1 — AbilitySystem

文件：`src/systems/AbilitySystem.ts`

MVP 最小实现，按子组件拆分：

##### 3.1a — TriggerDetector

```
监听 EventBus.emit 的事件 → 遍历场上所有卡的 abilities[] → 匹配 timing → 返回匹配列表

matchTiming(eventType, timing):
  CardPlayed     → timing === "WhenPlayed"
  PhaseChanged   → timing === "StartOfAttackPhase" / "StartOfTurn" / "EndOfTurn" (按需)
  TurnStarted    → timing === "StartOfTurn"
  TurnEnded      → timing === "EndOfTurn"
  (B4 加入更多映射)
```

##### 3.1b — ConditionEvaluator

```
evaluate(condition, context):
  IfOnFrontLine         → sourceCard 在 frontLine
  IfActive              → sourceCard.state === "Active"
  IfOpponentHasCharacter → 对方 frontLine.length > 0
  And / Or / Not        → 递归
  null (无条件)         → true
```

##### 3.1c — CostPayer

```
payCosts(costs, context) → StateChange[] | null:
  SwitchToResting  → sourceCard.state === "Active" ? 生成 SET_FIELD_STATE : null
  PayAp(n)         → availableAP >= n ? 生成 ADJUST_AP : null
  SidelineThisCard → 总是可支付 (生成 MOVE_CARD to Sideline)
  DiscardFromHand(n) → hand.length >= n
  全部可支付 → 返回 StateChange[] | 任一失败 → 返回 null (原子性)
```

##### 3.1d — EffectExecutor（MVP 最小效果集）

```
execute(effect, context) → { stateChanges, events }:

  DrawCard(count)       → 牌库顶 count 张 → 手牌
  BPBuff(amount)        → currentBP += amount (创建临时效果标记)
  SwitchToActive        → FieldState → "Active"
  SwitchToResting       → FieldState → "Resting"
  SidelineCharacter     → 目标角色 → Sideline → emit CardSidelined
  Sequence(subEffects)  → 按序执行 subEffects

  (B4 加入: DealDamage / SetDamageMultiplier et al.)
  (B5 加入: GainKeyword / LoseKeyword / PreventAttack et al.)
```

##### 3.1e — AbilityQueue（同时发动队列）

```
enqueue(abilities, turnPlayerId)
resolveAll(state) → { changes, events }:
  1. 回合玩家的能力排前面，非回合玩家排后面
  2. 同归属内任选顺序 (简化: 按 enqueue 顺序)
  3. 逐个结算: 条件复查 → 代价支付 → 效果执行 → 新触发加入队列尾部
  4. 直到队列为空

  ⚠️ RQ-009 默认策略（选项B）:
     新触发的能力保持归属优先级。对手的新能力在所有回合玩家
     剩余能力之后结算。（MVP 通过"队列分两段"实现：回合段 + 非回合段）
```

#### B3.2 — ActionSystem

文件：`src/core/ActionSystem.ts`

```typescript
class ActionSystem {
  constructor(
    private state: GameState,
    private eventBus: EventBus,
    private validator: RuleValidator,
    private cardRegistry: CardRegistry,
    private abilitySystem: AbilitySystem,
    private energySystem: EnergySystem
  ) {}

  submitAction(action: ActionRequest): ActionResult;
}
```

处理流程（以 PLAY_CHARACTER 为例）：
```
1. 验证: phase=Main, card in hand, canPayEnergy, canPayAP, zone capacity
2. 执行支付: AP Active→Resting
3. 卡牌移动: hand → targetZone, state=Resting
4. emit CardPlayed event
5. TriggerDetector → 匹配 WhenPlayed 能力
6. AbilityQueue.resolveAll → 结算所有触发的能力
7. 检查胜利条件 (B4 加入)
8. 返回 ActionResult
```

#### B3.3 — RuleValidator（扩展）

在 B2 基础上增加：

```
validatePlayCard(state, playerId, cardId, targetZone):
  + cardType=Site 只能 targetZone=EnergyLine
  + cardType=Event 不需要 targetZone (进入 Sideline)

validateActivateAbility(state, playerId, cardInstanceId, abilityId):
  + 卡在场上 (frontLine 或 energyLine)
  + abilityId 属于该卡的 abilities[]
  + ability.timing === "ActivateMain"
  + 代价可支付（委托 CostPayer 检查）
  + 条件满足（委托 ConditionEvaluator）
```

#### B3.4 — 追加 4 张测试卡

目录：`src/data/cards/test_set/`

| # | cardId | 类型 | BP | 能量需求 | 能力 | 测试目的 |
|---|--------|------|-----|---------|------|---------|
| 9 | `HTR-1-009` | Character | 2500 | 白×1 | ActivateMain ↻ Pay1AP: Draw 1 | Activate: Main 能力 |
| 10 | `HTR-1-010` | Character | 3000 | 红×2 | WhenPlayed: BP+1000 to self | WhenPlayed BP Buff |
| 11 | `HTR-1-011` | Event | — | 白×2 | Sideline 1 opponent front line character | 去除 Event |
| 12 | `HTR-1-012` | Site | — | 白×1 | WhenPlayed: Draw 1 | Site 带能力 |

> B3 累计 12 张测试卡。

### 测试方法

| 测试 | 验证点 |
|------|--------|
| WhenPlayed 触发检测 | 打出角色 → CardPlayed → 匹配 WhenPlayed |
| 条件评估：IfOnFrontLine | 角色在前线=true, 在能量线=false |
| 代价支付：SwitchToResting | Active→Resting |
| 代价原子性：部分失败→全部不付 | 状态不变 |
| 效果：DrawCard | 手牌+1, 卡组-1 |
| 效果：BPBuff+1000 | currentBP 从 3000 变 4000 |
| 效果：SidelineCharacter | 目标角色→Sideline |
| 效果：Sequence | 子效果按序执行 |
| 打出角色卡（能量够） | 手牌→前线, AP Active→Resting |
| 打出角色卡（能量不够） | 返回 error, 状态不变 |
| 打出 Site 卡 | 手牌→能量线 |
| 使用 Event 卡 | 效果结算 → Event 进 Sideline |
| Activate: Main 发动 | 手动触发, 代价支付 |
| 队列：回合玩家优先 | 回合方能力先结算 |
| 队列：RQ-009 选项B | 新能力保持归属优先级 |

### 影响文件

```
新增 (5个):
  src/systems/AbilitySystem.ts         (含全部 5 个子组件)
  src/core/ActionSystem.ts
  src/data/cards/test_set/HTR-1-009.json ~ HTR-1-012.json  (4个)
  tests/systems/AbilitySystem.test.ts
  tests/core/ActionSystem.test.ts

修改 (3个):
  src/core/types.ts                    (补充 AbilityInstance / AbilityContext 等)
  src/core/RuleValidator.ts            (补充 validatePlayCard / validateActivateAbility)
  src/core/GameState.ts                (补充 applyChanges 中的新 change type)
```

---

### ✅ Batch 3 人工确认清单

在进入 Batch 4 之前，请逐项确认：

```
[ ] 1. 运行 `npm test` 全部测试通过（含 B3 新增测试）
[ ] 2. 编写临时脚本，执行以下操作序列并观察 console.log：
       a. 在 Main Phase 将 HTR-1-007 打到前线
          → 手牌-1, 前线+1(状态=Resting, BP=3000)
          → CARD_PLAYED 事件触发
          → WhenPlayed: Draw 1 → 手牌+1
       b. 在 Main Phase 将 HTR-1-005 (Site) 打到能量线
          → 手牌-1, 能量线+1
          → 能量池: { "白": 1 }  (如果之前能量线为空)
       c. 使用 HTR-1-006 (Event)
          → Event 效果: Draw 1 → 手牌+1
          → Event 卡进入 Sideline
[ ] 3. 确认 When Played 能力在打出卡的瞬间触发（不是之后手动触发）
[ ] 4. 确认：未满足能量需求时，ActionSystem 返回 error，GameState 完全不変
[ ] 5. 确认 Activate: Main 需要玩家显式指定 abilityId 才能发动

签字：___________  日期：___________
```

---

## Batch 4：战斗系统 + 伤害 + Trigger

### 目标

实现完整的 Attack Phase：攻击宣言 → 阻挡宣言 → BP 比较 → 伤害结算 → Trigger 检查 → 胜负判定。**完整对局可玩。**

### 完成标准

- [ ] Attack Phase 生命周期：Idle → AttackerDeclaration → BlockerDeclaration → Resolving → Ending → Idle
- [ ] 攻击宣言：Active 角色 → Resting，目标 = 对方玩家或 Snipe 选角色
- [ ] 阻挡宣言：防御方 Active 角色 → Resting
- [ ] BP 比较：攻方 BP ≥ 目标 BP → 目标 Sideline（分支 A）；攻方 BP < 目标 BP → 攻方战败（分支 B）
- [ ] 直接伤害（未被阻挡）：伤害点数计算 → 翻生命卡 → Trigger 检查
- [ ] **Snipe**：可选对方角色为目标 + 不可阻挡（显式能力实现，非关键词展开）
- [ ] **Damage 2**：伤害=2（显式能力实现）
- [ ] **Impact 1**：战斗获胜→额外1点伤害（显式能力实现）
- [ ] Trigger：翻生命卡 → 可选发动 → 结算 → Sideline；多 Trigger 任意顺序
- [ ] 胜负判定：生命区 cardCount=0 → 对方胜利
- [ ] **完整对局可演示**：双方各 50 张卡 → 打到一方生命为 0

### 具体任务

#### B4.1 — DamageSystem

文件：`src/systems/DamageSystem.ts`

```typescript
class DamageSystem {
  // 计算一次攻击的伤害点数
  calculateDamage(attacker: CardOnField, battleState: BattleState): number;
  // 基础=1, 有"Damage 2"效果→2, 有"Damage +1"效果→+1

  // 对玩家造成伤害
  dealDamage(state: GameState, targetPlayerId: string, amount: number,
             sourcePlayerId: string): { changes: StateChange[]; lifeCards: CardInZone[] };
  // 攻击方选择生命卡 → 返回被选中的卡列表（供 TriggerSystem 处理）
}
```

#### B4.2 — TriggerSystem

文件：`src/systems/TriggerSystem.ts`

```typescript
class TriggerSystem {
  // 检查单张生命卡是否有 Trigger
  hasTrigger(card: CardInZone, registry: CardRegistry): boolean;

  // 获取 Trigger 能力数据
  getTriggerAbility(card: CardInZone, registry: CardRegistry): AbilityData | null;

  // 结算 Trigger（发动 or 不发动）
  resolveTrigger(state: GameState, card: CardInZone, activate: boolean): StateChange[];
  // activate=true → 结算 ability → 卡进 Sideline
  // activate=false → 卡直接进 Sideline

  // 处理多点伤害的多张 Trigger
  processTriggers(state: GameState, lifeCards: CardInZone[], playerId: string): TriggerProcessResult;
  // 防御方选择顺序 → 逐张：选是否发动 → 结算 → Sideline
}
```

#### B4.3 — BattleSystem

文件：`src/systems/BattleSystem.ts`

```typescript
class BattleSystem {
  constructor(private eventBus: EventBus, private damageSystem: DamageSystem,
              private triggerSystem: TriggerSystem, private abilitySystem: AbilitySystem) {}

  // 攻击阶段生命周期
  startAttackPhase(state: GameState): StateChange[];
  declareAttack(state: GameState, attackerInstanceId: string,
                targetType: 'Player' | 'Character', targetInstanceId?: string): ActionResult;
  declareBlock(state: GameState, blockerInstanceId: string): ActionResult;
  skipBlock(state: GameState): ActionResult;           // 防御方选择不阻挡
  resolveBattle(state: GameState): ActionResult;        // BP 比较 + 伤害 + Trigger
  endBattle(state: GameState): StateChange[];           // 清理 + Double Attack
  endAttackPhase(state: GameState): StateChange[];
}
```

**战斗结算分支**（`resolveBattle`）：
```
有阻挡（角色 vs 角色）：
  ├─ attackerBP >= blockerBP → 分支 A:
  │   1. blocker → Sideline → emit CharacterSidelinedByBattle
  │   2. 检查 Impact 效果 → 对防御方造成额外伤害
  │   3. 结算 WhenBattleWins
  └─ attackerBP < blockerBP → 分支 B:
      1. 结算 WhenBattleLoses (攻击方)
      2. 结算 WhenBattleWins (防御方)

无阻挡（角色 vs 玩家）：
  1. 结算 WhenNotBlocked 效果
  2. DamageSystem.calculateDamage → 伤害点数
  3. DamageSystem.dealDamage → 选生命卡
  4. TriggerSystem.processTriggers → Trigger 结算

Snipe（角色 vs 角色，不可阻挡）：
  → 同有阻挡 BP 比较
```

**攻击阶段循环**：
```
Attack Phase Idle
  → declareAttack → resolveBattle → endBattle → 回到 Idle
  → 无 Active 角色 或 玩家选择结束 → endAttackPhase
```

#### B4.4 — 胜负判定

在 `ActionSystem.submitAction` 和 `BattleSystem.resolveBattle` 中集成：

```typescript
function checkWinCondition(state: GameState): string | null {
  for (const [playerId, playerState] of Object.entries(state.players)) {
    if (playerState.lifeArea.length === 0) {
      const opponentId = /* 找到对方 */;
      return opponentId;  // 对方胜利
    }
  }
  return null;
}
```

⚠️ 牌库空判定仅在 Start Phase 强制抽牌时检查：
```typescript
// TurnManager.executeStartPhase 中
if (playerState.deck.length === 0 && isMandatoryDraw) {
  // 对方胜利
}
```

#### B4.5 — RuleValidator（扩展）

在 B3 基础上增加战斗验证：

```
validateAttack(state, attackerInstanceId, targetType, targetInstanceId):
  + phase === "Attack"
  + card in frontLine
  + card.state === "Active"
  + BattleState.step === "Idle" (没有正在进行的战斗)
  + targetType="Character" → 目标在对方 frontLine (Snipe 允许)

validateBlock(state, blockerInstanceId):
  + BattleState.step === "BlockerDeclaration"
  + !battleState.isSnipe (Snipe 不可阻挡)
  + blocker in frontLine, state=Active
```

#### B4.6 — 追加 4 张测试卡

| # | cardId | 类型 | BP | 能量需求 | 能力 | 测试目的 |
|---|--------|------|-----|---------|------|---------|
| 13 | `HTR-1-013` | Character | 3000 | 白×1 | 显式 Snipe 能力(注) + Trigger: Draw 1 | Snipe + Trigger |
| 14 | `HTR-1-014` | Character | 4000 | 白×1 | 显式 Impact 1 能力(注) | Impact 战斗获胜伤害 |
| 15 | `HTR-1-015` | Character | 3500 | 白×1 | 显式 Damage 2 能力(注) | 多点直接伤害 |
| 16 | `HTR-1-016` | Character | 3000 | 白×2 | WhenAttacking: BP+2000 | 攻击时 BP Buff |

> **注**：B4 的 Snipe / Impact / Damage 仍然用**显式能力 JSON** 手写，不使用关键词。
> 关键词展开在 B5 统一加入。这确保 B4 验证的是能力引擎的正确性，
> 而非关键词展开的正确性 — 两者解耦。

**显式 Snipe 能力示例**（HTR-1-013）：
```json
{
  "abilities": [
    {
      "abilityId": "HTR-1-013-ABL-1",
      "timing": "WhenAttacking",
      "costs": [],
      "effects": [
        { "effectType": "AllowTargetCharacter" },
        { "effectType": "PreventBlock" }
      ],
      "isOptional": false
    }
  ],
  "trigger": {
    "abilityId": "HTR-1-013-TRG-1",
    "timing": "Trigger",
    "costs": [],
    "effects": [{ "effectType": "DrawCard", "params": { "count": 1 } }],
    "isOptional": true
  },
  "keywords": []
}
```

> B4 累计 16 张测试卡。

### 测试方法

| 测试 | 验证点 |
|------|--------|
| 攻击宣言：Active→Resting | 状态切换 + BattleState 创建 |
| 非 Active 角色不可攻击 | RuleValidator 拒绝 |
| 阻挡宣言 | 状态切换 + blocker 设置 |
| Snipe 可选角色为目标 | 目标为对方前线角色 |
| Snipe 不可阻挡 | skip 阻挡步骤 |
| BP 胜利 → Sideline | 分支 A 完整流程 |
| BP 相等 → 攻方胜 | 边界规则 |
| BP 战败 → 攻方留场 | 分支 B |
| 直接伤害 1 → 翻 1 张生命 | 伤害流程 |
| Damage 2 → 翻 2 张 | 伤害倍率 |
| Impact 1 → 额外 1 点 | 战斗获胜后额外伤害 |
| Trigger 可选发动 | 发动→结算→Sideline |
| Trigger 不发动 | 直接 Sideline |
| 无 Trigger | 直接 Sideline |
| 多 Trigger 任意顺序 | 防御方自选 |
| 生命区=0 → 对方胜利 | 胜负判定 |
| WhenAttacking 触发 | 攻击宣言时能力 |
| WhenBlocking 触发 | 阻挡宣言时能力 |

### 影响文件

```
新增 (8个):
  src/systems/DamageSystem.ts
  src/systems/TriggerSystem.ts
  src/systems/BattleSystem.ts
  src/data/cards/test_set/HTR-1-013.json ~ HTR-1-016.json  (4个)
  tests/systems/DamageSystem.test.ts
  tests/systems/TriggerSystem.test.ts
  tests/systems/BattleSystem.test.ts
  tests/integration/battle_flow.test.ts

修改 (5个):
  src/core/types.ts           (补充 BattleState / BattleStep / DamageResult 等)
  src/core/ActionSystem.ts    (集成 BattleSystem + 胜负判定)
  src/core/TurnManager.ts     (Attack Phase 集成 BattleSystem)
  src/core/RuleValidator.ts   (补充战斗验证)
  src/systems/AbilitySystem.ts (补充 WhenAttacking/WhenBlocking/WhenBattleWins/WhenNotBlocked 映射)
```

---

### ✅ Batch 4 人工确认清单

在进入 Batch 5 之前，请逐项确认：

```
[ ] 1. 运行 `npm test` 全部测试通过（含 B4 新增测试）
[ ] 2. 编写临时脚本，执行一次完整战斗流程：
       a. P2 前线有 1 个 Active 角色 (HTR-1-001, BP=3000)
       b. P1 前线有 1 个 Active 角色 (HTR-1-002, BP=4000)
       c. P1 Attack Phase: declareAttack(HTR-1-002, target=Player)
       d. P2 选择不阻挡
       e. 伤害结算: 1 点伤害 → 翻 P2 生命卡 1 张 → Trigger 检查
       f. 输出每个步骤的 GameState 变化
[ ] 3. 再执行一次有阻挡的战斗：
       a. P1 攻击 → P2 选择 blocker (HTR-1-001, BP=3000)
       b. BP 比较: 4000 >= 3000 → P1 胜 → P2 的 HTR-1-001 进 Sideline
       c. 检查 Impact 效果（如果攻击方有 Impact 1 → 额外 1 点伤害）
[ ] 4. 执行 Snipe 攻击：
       a. P1 使用 HTR-1-013 (有 Snipe 显式能力) 攻击 P2 前线的角色
       b. 确认 P2 不能选择阻挡（PreventBlock 生效）
       c. BP 比较 → 胜负判定
[ ] 5. 模拟 Damage 2 攻击：
       a. P1 使用 HTR-1-015 (Damage 2) 攻击 P2 玩家, P2 不阻挡
       b. 翻 2 张生命卡 → 如果 2 张都有 Trigger → P2 选择顺序逐张结算
[ ] 6. 触发胜利条件：将一方生命区手动设为空 → 确认 winner 正确设置
[ ] 7. 最重要：尝试用现有 16 张卡 + 34 张复制卡（凑成 50 张卡组），
       手动操作一局完整游戏直到一方胜利。记录任何崩溃或规则错误。

签字：___________  日期：___________
```

---

## Batch 5：Raid + 关键词系统 + 卡牌补全

### 目标

实现 RaidSystem 和关键词展开系统。补全全部 20 张测试卡，其中部分卡改用关键词标记 + 引擎展开。全部 9 种关键词可正常工作。

### 关键词分流策略

```
B1-B4（引擎验证期）:
  所有能力用显式 JSON 手写，keywords 字段留空。
  → 验证引擎核心（AbilitySystem / BattleSystem / TriggerSystem）正确性。

B5（系统完成期）:
  引入 KeywordSystem：
    1. 创建 keyword_definitions.json：关键词 → 等效 AbilityData[]
    2. CardSystem 增加 expandKeywords(cardData) → CardData
    3. 加载卡牌时自动展开
    4. 部分测试卡改用关键词标记
  → 验证关键词展开 + 引擎集成。
```

### 完成标准

- [ ] KeywordSystem：9 种关键词正确定义并可展开
- [ ] CardSystem 加载时自动调用 `expandKeywords`
- [ ] 至少 4 张卡改用关键词标记（而非显式能力），加载后效果一致
- [ ] Raid 打出：目标验证 → 堆叠 → Active → 可选移前线 → When Played
- [ ] Raid 普通打出：raidAbilities 完全不生效（RQ-004）
- [ ] Raid 卡离开场上：顶层去目标区 + 底层进 Sideline
- [ ] Nullify Impact / Double Attack / Double Block 正确生效
- [ ] Step 关键词的逆向移动正确
- [ ] 全部 20 张测试卡 + 50 张卡组可构建

### 具体任务

#### B5.1 — 关键词展开系统

新增文件：`src/data/keywords/keyword_definitions.json`

```json
{
  "Snipe": {
    "description": "When attacking, may target a character. Cannot be blocked.",
    "abilities": [
      {
        "abilityId": "KEYWORD-SNIPE-1",
        "timing": "WhenAttacking",
        "costs": [],
        "effects": [{ "effectType": "AllowTargetCharacter" }, { "effectType": "PreventBlock" }],
        "isOptional": false
      }
    ]
  },
  "Impact 1": {
    "abilities": [
      {
        "abilityId": "KEYWORD-IMPACT1-1",
        "timing": "WhenBattleWins",
        "costs": [],
        "effects": [{ "effectType": "DealDamage", "params": { "amount": 1, "target": "Opponent" } }],
        "isOptional": false
      }
    ]
  },
  "...": "其余 7 种关键词定义"
}
```

修改：`src/systems/CardSystem.ts`

```typescript
class CardSystem {
  // B5 新增
  static loadKeywordDefinitions(filePath: string): Map<string, AbilityData[]>;
  static expandKeywords(card: CardData, keywordDefs: Map<string, AbilityData[]>): CardData;
  // CardData.keywords[] 中的每个关键词 → 查找定义 → 追加到 abilities[]
}
```

> 加载管道（B5 完整版）：
> ```
> Card JSON File → Schema 验证 → expandKeywords → createRegistry
> ```

#### B5.2 — RaidSystem

文件：`src/systems/RaidSystem.ts`

```typescript
class RaidSystem {
  // 验证 Raid 目标
  validateRaidTarget(state: GameState, card: CardData, targetInstanceId: string): boolean;

  // 执行 Raid
  performRaid(state: GameState, cardInstanceId: string,
              targetInstanceId: string): { changes: StateChange[]; events: GameEvent[] };
  // 1. 验证目标 + 能量 + AP
  // 2. 堆叠在目标上（raiding/raidedBy 关系）
  // 3. 底层卡状态 → Active（如果之前是 Resting）
  // 4. 在能量线 → 可选移前线
  // 5. 注册 abilities + raidAbilities（RQ-004）
  // 6. emit CardPlayed → 触发 WhenPlayed

  // Raid 卡离开场上时清理
  handleRaidCardLeaving(state: GameState, instanceId: string,
                        destination: Zone): StateChange[];
  // 顶层去 destination, 底层→Sideline
}
```

#### B5.3 — 追加 4 张测试卡 + 关键词改造

| # | cardId | 类型 | BP | 能量需求 | 能力 / 关键词 | 测试目的 |
|---|--------|------|-----|---------|--------------|---------|
| 17 | `HTR-1-017` | Character | 4000 | 红×1 | Raid(target:HTR-1-001), raidAbilities:[SwitchActive, MoveFront] | Raid 基础 |
| 18 | `HTR-1-018` | Character | 4500 | 红×1 | Raid(target:HTR-1-002), raidAbilities:[SwitchActive, MoveFront], WhenPlayed:BP+1000 | Raid+WhenPlayed |
| 19 | `HTR-1-019` | Character | 3000 | 白×1 | keywords:[Double Attack] | 关键词：Double Attack |
| 20 | `HTR-1-020` | Character | 3000 | 白×2 | keywords:[Step, Nullify Impact] | 关键词：Step + Nullify |

**关键词改造**（将 B1-B4 中部分显式能力改为关键词标记）：

| cardId | 原显式能力 | 改用关键词 |
|--------|-----------|-----------|
| `HTR-1-013` (B4) | AllowTargetCharacter + PreventBlock | `keywords: ["Snipe"]` |
| `HTR-1-014` (B4) | WhenBattleWins: DealDamage(1) | `keywords: ["Impact 1"]` |
| `HTR-1-015` (B4) | WhenNotBlocked: SetDamageMultiplier(2) | `keywords: ["Damage 2"]` |
| `HTR-1-019` (B5 新) | — | `keywords: ["Double Attack"]` |
| `HTR-1-020` (B5 新) | — | `keywords: ["Step", "Nullify Impact"]` |

> **验证方式**：将 HTR-1-013 的 B4 显式版本与 B5 关键词版本分别加载，确认两者 `abilities[]` 内容一致（关键词展开后的结果 = B4 手写的显式 JSON）。

#### B5.4 — 补全 50 张卡组

为支持完整对局，编写 `tests/fixtures/test_decks.ts`：

```typescript
function createFullDeck(cardIds: string[], registry: CardRegistry): CardData[] {
  // 50 张卡组 = 20 张独特测试卡 + 复制满足同名≤4 规则
  // 例如：8 张香草角色各 ×4 = 32, 4 张 Site 各 ×3 = 12, 4 张 Event 各 ×1.5 ...
  // 实际方案：使用 test_cards 工厂生成填充卡
}
```

### 测试方法

| 测试 | 验证点 |
|------|--------|
| 9 种关键词全部展开 | 展开后 abilities[] 内容正确 |
| B4 显式版 vs B5 关键词版等价 | abilities[] 一致 |
| Raid 目标匹配（Name/Affinity） | 验证通过/拒绝 |
| Raid 堆叠 → Active → 移前线 | 全流程 |
| 普通打出 Raid 卡 → raidAbilities 不生效 | RQ-004 |
| Raid 卡离开 → 底层 Sideline | 堆叠清理 |
| Double Attack：首次攻击后 Active 恢复 | 状态切换 |
| Double Block：首次阻挡后 Active 恢复 | 状态切换 |
| Nullify Impact：对方 Impact 失效 | 关键词屏蔽 |
| Step：前线→能量线逆向移动 | 逆移动 |
| 50 张卡组可创建 | 卡组构建验证 |

### 影响文件

```
新增 (8个):
  src/systems/RaidSystem.ts
  src/data/keywords/keyword_definitions.json
  src/data/cards/test_set/HTR-1-017.json ~ HTR-1-020.json  (4个)
  tests/systems/RaidSystem.test.ts
  tests/integration/raid_flow.test.ts
  tests/fixtures/test_decks.ts

修改 (6个):
  src/systems/CardSystem.ts              (增加 expandKeywords + loadKeywordDefinitions)
  src/data/cards/test_set/HTR-1-013.json (改用 keywords: ["Snipe"])
  src/data/cards/test_set/HTR-1-014.json (改用 keywords: ["Impact 1"])
  src/data/cards/test_set/HTR-1-015.json (改用 keywords: ["Damage 2"])
  src/systems/AbilitySystem.ts           (补充 GainKeyword/LoseKeyword/NullifyKeyword 效果)
  src/systems/BattleSystem.ts            (集成 Nullify Impact / Double Attack / Double Block)
  src/systems/MovementSystem.ts          (支持 Step 逆移动)
  src/core/ActionSystem.ts               (集成 Raid 操作)
```

---

### ✅ Batch 5 人工确认清单

在进入 Batch 6 之前，请逐项确认：

```
[ ] 1. 运行 `npm test` 全部测试通过（含 B5 新增测试）
[ ] 2. 关键词等价性验证：
       a. 加载 HTR-1-013 的 B4 版本（显式 Snipe 能力）→ 记录 abilities[0] 内容
       b. 加载 HTR-1-013 的 B5 版本（keywords:["Snipe"]）→ expandKeywords 后
          abilities[] 是否与 B4 版本一致？
[ ] 3. Raid 流程验证：
       a. 前线有 HTR-1-001 (Resting)
       b. P1 Main Phase: Raid 打出 HTR-1-017，堆叠在 HTR-1-001 上
       c. 确认 HTR-1-017 为 Active → HTR-1-001 能力失效
       d. 同一回合 Attack Phase: HTR-1-017 可以攻击（Active 状态）
[ ] 4. Raid 普通打出验证：
       a. P1 Main Phase: 普通打出 HTR-1-017（不 Raid）
       b. 确认 raidAbilities 不生效（没有 SwitchToActive / MoveToFrontLine）
[ ] 5. Double Attack 验证：
       a. HTR-1-019 (keywords:["Double Attack"]) 攻击
       b. 首次攻击结束后 → 角色从 Resting 恢复为 Active
[ ] 6. Step 逆向移动验证：
       a. Movement Phase 中 HTR-1-020 (keywords:["Step"]) 从 前线→能量线
       b. 确认移动成功
[ ] 7. Nullify Impact 验证：
       a. 攻击方有 Impact 1, 防御方有 HTR-1-020 (Nullify Impact) 阻挡
       b. 攻击方战斗获胜 → Impact 不触发（被 Nullify）

签字：___________  日期：___________
```

---

## Batch 6：GameEngine 集成 + 场景脚本 + 端到端测试

### 目标

实现 GameEngine 门面类，编写预定义场景脚本，完成端到端测试。MVP 可一键运行完整对局。

### 完成标准

- [ ] GameEngine 封装所有子系统：`newGame()` / `submitAction()` / `getState()`
- [ ] 4 个预定义场景脚本可成功运行
- [ ] E2E 测试：自动运行完整对局直到一方胜利
- [ ] `npm test` 全部通过（预计 50+ 测试用例）
- [ ] `npm run scenario basic_game` 一键运行完整对局
- [ ] README 文档

### 具体任务

#### B6.1 — GameEngine

文件：`src/core/GameEngine.ts`

```typescript
class GameEngine {
  private state: GameState;
  private eventBus: EventBus;
  private turnManager: TurnManager;
  private actionSystem: ActionSystem;
  // ...

  async newGame(config: GameConfig): Promise<GameState>;
  submitAction(action: ActionRequest): ActionResult;
  getState(): GameState;
  getValidActions(playerId: string): ActionRequest[];
}
```

#### B6.2 — 场景脚本

目录：`src/scenarios/`

| 文件 | 内容 |
|------|------|
| `scenario_basic_game.ts` | 完整一局：P1/P2 交替回合 → 打牌 → 攻击 → 直到一方胜利 |
| `scenario_battle.ts` | 战斗专项：攻击→阻挡→Snipe→Impact→Damage 2 |
| `scenario_raid.ts` | Raid 专项：普通打出→Raid 堆叠→能力分离→堆叠清理 |
| `scenario_trigger.ts` | Trigger 专项：多点伤害→多 Trigger→任意顺序结算 |

#### B6.3 — 入口

文件：`src/index.ts`

```
npm run scenario basic_game   → 运行预设场景
npm run scenario battle       → 运行战斗场景
npm run scenario raid         → 运行 Raid 场景
npm run scenario trigger      → 运行 Trigger 场景
npm test                      → 运行全部测试
```

#### B6.4 — E2E 测试

文件：`tests/integration/full_game.test.ts`

```
1. 创建 GameEngine，加载双方各 50 张卡
2. 自动执行回合循环直到 winner != null
3. 验证 winner 合法
4. 验证未崩溃
```

### 影响文件

```
新增 (8个):
  src/core/GameEngine.ts
  src/index.ts
  src/scenarios/scenario_basic_game.ts
  src/scenarios/scenario_battle.ts
  src/scenarios/scenario_raid.ts
  src/scenarios/scenario_trigger.ts
  tests/core/GameEngine.test.ts
  tests/integration/full_game.test.ts
  README.md

修改 (1个):
  package.json  (补充 scripts)
```

---

### ✅ Batch 6 人工确认清单（最终验收）

```
[ ] 1. 运行 `npm test` → 全部测试通过，输出绿色 √
[ ] 2. 运行 `npm run scenario basic_game` → 完整对局自动运行到一方胜利
       输出每一步操作和状态变更，无崩溃
[ ] 3. 运行 `npm run scenario battle` → 覆盖攻防流程
[ ] 4. 运行 `npm run scenario raid` → 覆盖 Raid 全流程
[ ] 5. 运行 `npm run scenario trigger` → 覆盖多 Trigger 顺序
[ ] 6. 阅读 E2E 测试输出：检查是否成功触发过 WhenPlayed / WhenAttacking / Trigger
[ ] 7. 检查 package.json scripts 齐全、README 可指导他人运行

签字：___________  日期：___________
```

---

## 附录 A：关键词分流方案

```
MVP 分为两阶段：

阶段 A（B1-B4）：无关键词 — 引擎验证期
  - 所有卡牌能力用显式 JSON 手写
  - CardData.keywords = []
  - CardSystem 不调用 expandKeywords
  - 目的：独立验证 AbilitySystem 正确性

阶段 B（B5）：引入关键词 — 系统完成期
  - 创建 keyword_definitions.json（9 种）
  - CardSystem 管道加入 expandKeywords
  - 部分卡牌改用 keywords 标记
  - 目的：验证关键词展开 + 与引擎集成
  - 验证方式：B4 显式版 vs B5 关键词版 — abilities[] 等价

好处：
  - B1-B4 的 bug 只能是引擎逻辑 bug，不可能是关键词展开 bug
  - B5 时引擎已验证稳定，关键词展开问题易排查
```

## 附录 B：卡牌数量渐进表

| Batch | 新增卡 | 累计卡 | 卡牌特点 |
|-------|--------|--------|---------|
| B1 | 8 张 | 8 | 香草角色 + 基础 Site/Event + 简单 WhenPlayed |
| B3 | 4 张 | 12 | ActivateMain + BP Buff + 去除 Event + Site 能力 |
| B4 | 4 张 | 16 | Snipe/Damage/Impact (显式) + Trigger + WhenAttacking |
| B5 | 4 张 | 20 | Raid + 关键词标记 |
| B6 | 0 | 20 | 用工厂函数填充至 50 张卡组 |

## 附录 C：效果类型渐进表

| Batch | 新增效果类型 | 说明 |
|-------|-------------|------|
| B3 | DrawCard / BPBuff / SwitchToActive / SwitchToResting / SidelineCharacter / Sequence | MVP 最小效果集 |
| B4 | DealDamage / SetDamageMultiplier / ModifyDamage / AllowTargetCharacter / PreventBlock | 战斗相关效果 |
| B5 | GainKeyword / LoseKeyword / NullifyKeyword / PreventAttack / AllowReverseMovement | 关键词相关效果 |

---

> **关联文档**：
> - `MVP_IMPLEMENTATION_PLAN.md` — MVP 范围与数据结构设计
> - `Architecture.md` — 完整模块架构
> - `Card_System.md` — 卡牌数据结构参考
> - `Battle_System.md` — 战斗流程参考
> - `Game_Design.md` — 回合/阶段/区域
> - `Rule_Resolution.md` — 9 条规则裁决
