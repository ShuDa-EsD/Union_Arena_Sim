# Union Arena Digital — MVP Implementation Plan

> 版本：1.0
> 创建日期：2026-08-03
> 状态：等待确认
>
> 本文档定义 Union Arena Digital MVP 的完整实现计划。
> 基于 Architecture.md / Card_System.md / Battle_System.md / Game_Design.md / Rule_Resolution.md。

---

## 目录

1. [MVP 范围](#1-mvp-范围)
2. [文件结构](#2-文件结构)
3. [系统开发顺序](#3-系统开发顺序)
4. [数据结构设计](#4-数据结构设计)
5. [测试方案](#5-测试方案)

---

## 1. MVP 范围

### 1.1 MVP 定义

**MVP = Console 规则模拟器**。无 UI、无网络、无 AI、无动画。

交付形式：一个 Node.js 脚本，可以：
- 加载测试卡牌数据
- 初始化一局游戏
- 按预定义脚本（或命令行 REPL）执行玩家操作
- 输出每一步的状态变更到控制台
- 自动运行测试用例验证规则正确性

### 1.2 实现什么 ✅

| # | 功能 | 说明 |
|---|------|------|
| 1 | 创建游戏状态 | 双玩家、全区域初始化、洗牌、抽牌、调度、生命区设置 |
| 2 | 创建玩家 | Player One / Player Two，先手/后手区分 |
| 3 | 初始化卡组 | 50张卡组 + 3张AP卡，从 JSON 加载 |
| 4 | 开始回合 | 完整的5阶段状态机：Start → Movement → Main → Attack → End |
| 5 | 执行抽牌 | Start Phase 强制抽牌 + 额外抽牌（支付1AP） |
| 6 | 管理 Energy | 能量线汇总计算 + 颜色匹配 + `canAfford()` |
| 7 | 打出角色卡 | 能量检查 → AP支付 → 放置前线/能量线 → Resting |
| 8 | 角色进入场地 | 打出/Raid/效果入场 + When Played 触发 |
| 9 | 基础攻击 | 攻击宣言 → 阻挡宣言 → 直接伤害 |
| 10 | BP战斗结算 | BP比较 → 胜/败分支 → Sideline + Impact |
| 11 | 基础 Ability | When Played / Activate: Main / When Attacking / When Blocking |
| 12 | Raid | 目标验证 → 堆叠 → Active → When Played |
| 13 | Trigger | 翻生命卡 → 可选发动 → Sideline |
| 14 | 胜负判断 | 生命为0 / 牌库空 |
| 15 | 9种关键词 | Step / Snipe / Double Attack / Double Block / Impact 1 / Impact +1 / Damage 2 / Damage +1 / Nullify Impact |
| 16 | AP系统 | 先手1/后手2/第3回合起3张，支付AP |
| 17 | Movement Phase | 能量线→前线移动 + 容量检查 |
| 18 | End Phase | 手牌上限8张检查 |
| 19 | 先手限制 | Player One Turn 1 跳过 Attack Phase（RQ-008） |
| 20 | 20张测试卡 | 覆盖4种类型 + 全部关键词 + 常见能力模式 |

### 1.3 不实现什么 ❌

| 类别 | 内容 | 原因 |
|------|------|------|
| **UI** | Phaser 前端、Canvas渲染、动画 | 阶段3 |
| **美术** | 卡面图片、UI素材 | 阶段3 |
| **网络** | WebSocket、双人对战、房间 | 阶段3 |
| **账号** | 用户系统、卡牌收藏 | 阶段3 |
| **AI** | AI 对手决策 | 阶段3 |
| **DSL** | 卡牌能力 DSL 解析器 | MVP直接用结构化JSON |
| **DeckBuilder** | 卡组构筑验证UI | 手动验证规则即可 |
| **StateHistory** | 完整的状态回溯/Replay | MVP用简单日志替代 |
| **效果系统全量** | 6大类效果中仅实现 MVP 需要的 | Search/Mill/Look等 MVP 不需要 |
| **复杂目标选择** | `upTo:N`、多条件筛选 | MVP 卡牌目标简单 |
| **Once Per Turn 追踪** | 能力使用次数限制 | 可后续加入，不影响核心流程 |
| **持续性效果管理** | DurationManager 完整版 | MVP 仅实现 DuringBattle / UntilEndOfTurn |
| **替代效果** | `{x} instead` | P2 功能 |
| **RQ-009 最终方案** | 新触发能力队列插入位置 | 默认用选项B（归属优先级），策略模式预留 |

### 1.4 MVP 架构简化

相比 Architecture.md 的 16 模块设计，MVP 做以下简化：

| 原模块 | MVP 处理方式 |
|--------|-------------|
| GameEngine (M1) | ✅ 简化版：`GameEngine` 类，直接编排 |
| GameState (M2) | ✅ 完整实现 |
| TurnManager (M3) | ✅ 完整实现 |
| ActionSystem (M4) | ✅ 简化版：方法调用代替 Action 对象 |
| RuleValidator (M5) | ✅ 简化版：内联验证，不做独立模块 |
| EventBus (M6) | ✅ 简化版：同步事件发布/订阅 |
| CardSystem (M7) | ✅ 完整实现（加载 + 验证 + 关键词展开） |
| EnergySystem (M8) | ✅ 完整实现 |
| AbilitySystem (M9) | ✅ 核心子集：触发检测 + 条件 + 代价 + 效果执行 |
| BattleSystem (M10) | ✅ 完整实现 |
| MovementSystem (M11) | ✅ 完整实现 |
| DamageSystem (M12) | ✅ 完整实现 |
| TriggerSystem (M13) | ✅ 完整实现 |
| RaidSystem (M14) | ✅ 完整实现 |
| StateHistory (M15) | ❌ 推迟 — 用 console.log 代替 |
| DeckBuilder (M16) | ❌ 推迟 — 手动验证 |

---

## 2. 文件结构

```
union-arena-sim/
├── package.json
├── tsconfig.json
├── jest.config.js                     # 或 vitest.config.ts
├── README.md
│
├── src/
│   ├── index.ts                       # 入口：REPL 或脚本执行
│   │
│   ├── core/                          # 核心引擎
│   │   ├── types.ts                   # 全部基础类型 & 枚举 & 接口
│   │   ├── GameEngine.ts              # 引擎门面：newGame / startGame / submitAction
│   │   ├── GameState.ts               # 不可变游戏状态 + 状态更新
│   │   ├── EventBus.ts                # 同步事件发布/订阅
│   │   ├── TurnManager.ts             # 5阶段状态机
│   │   ├── RuleValidator.ts           # 规则合法性检查（集中化）
│   │   └── ActionSystem.ts            # 操作接收 → 验证 → 执行 → 状态更新
│   │
│   ├── systems/                       # 领域子系统
│   │   ├── CardSystem.ts              # 卡牌加载/验证/关键词展开/注册
│   │   ├── EnergySystem.ts            # 能量汇总 + canAfford
│   │   ├── MovementSystem.ts          # 移动阶段 + 容量超限
│   │   ├── AbilitySystem.ts           # 能力触发/条件/代价/效果/队列
│   │   ├── BattleSystem.ts            # 攻击→阻挡→BP结算→伤害
│   │   ├── DamageSystem.ts            # 伤害计算 + 生命卡处理
│   │   ├── TriggerSystem.ts           # Trigger检查 + 发动
│   │   └── RaidSystem.ts              # Raid 验证 + 堆叠
│   │
│   ├── data/                          # 卡牌数据
│   │   ├── schema/
│   │   │   └── card_schema.json       # JSON Schema 验证
│   │   ├── keywords/
│   │   │   └── keyword_definitions.json  # 9种关键词定义
│   │   └── cards/
│   │       └── test_set/
│   │           ├── HTR-1-001.json     # 测试卡牌（全部20张）
│   │           ├── HTR-1-002.json
│   │           └── ...                # HTR-1-020.json
│   │
│   ├── scenarios/                     # 预定义测试场景（脚本驱动）
│   │   ├── scenario_basic_game.ts     # 完整一局游戏
│   │   ├── scenario_battle.ts         # 战斗专项场景
│   │   ├── scenario_raid.ts           # Raid 专项场景
│   │   └── scenario_trigger.ts        # Trigger 专项场景
│   │
│   └── utils/                         # 工具函数
│       ├── shuffle.ts                 # Fisher-Yates 洗牌
│       ├── logger.ts                  # 结构化日志输出
│       └── idgen.ts                   # 实例ID生成器
│
├── tests/                             # 单元测试
│   ├── core/
│   │   ├── GameState.test.ts
│   │   ├── TurnManager.test.ts
│   │   ├── EventBus.test.ts
│   │   ├── RuleValidator.test.ts
│   │   └── ActionSystem.test.ts
│   ├── systems/
│   │   ├── CardSystem.test.ts
│   │   ├── EnergySystem.test.ts
│   │   ├── MovementSystem.test.ts
│   │   ├── AbilitySystem.test.ts
│   │   ├── BattleSystem.test.ts
│   │   ├── DamageSystem.test.ts
│   │   ├── TriggerSystem.test.ts
│   │   └── RaidSystem.test.ts
│   ├── integration/
│   │   ├── full_turn.test.ts          # 完整回合集成测试
│   │   ├── battle_flow.test.ts        # 战斗流程集成测试
│   │   ├── trigger_chain.test.ts      # Trigger 链集成测试
│   │   ├── raid_flow.test.ts          # Raid 流程集成测试
│   │   └── full_game.test.ts          # 端到端完整游戏测试
│   └── fixtures/
│       ├── test_cards.ts              # 测试卡牌数据工厂
│       ├── test_state.ts              # 测试用 GameState 工厂
│       └── test_decks.ts              # 测试用卡组
│
└── Documents/                         # 设计文档（已有）
    ├── MVP_IMPLEMENTATION_PLAN.md     # 本文件
    ├── Architecture.md
    ├── Rule_Resolution.md
    ├── Rule_Impact_Report.md
    ├── Project_Roadmap.md
    ├── design/
    │   ├── Game_Design.md
    │   ├── Battle_System.md
    │   └── Card_System.md
    └── rules_EnglishVer/
        └── hybrid_auto/
            └── rules_EnglishVer.md
```

---

## 3. 系统开发顺序

### 3.1 依赖关系图（简化版）

```
                    ┌─────────────┐
                    │   types.ts  │  (无依赖)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ EventBus │ │CardSystem│ │ shuffle  │
        │   (B0)   │ │  (B1)    │ │  utils   │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             ▼            ▼            ▼
        ┌──────────────────────────────────┐
        │           GameState (B1)          │
        └────────────────┬─────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │  Energy  │ │ Movement │ │ TurnManager   │
        │  System  │ │  System  │ │   (B2)        │
        │  (B2)    │ │  (B2)    │ │               │
        └────┬─────┘ └────┬─────┘ └───────┬───────┘
             │            │               │
             └────────────┼───────────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │  RuleValidator   │
                 │     (B2)         │
                 └────────┬─────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Ability  │ │  Damage  │ │  Raid    │
        │ System   │ │  System  │ │  System  │
        │  (B3)    │ │  (B3)    │ │  (B3)    │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Battle   │ │ Trigger  │ │ Action   │
        │ System   │ │ System   │ │ System   │
        │  (B3)    │ │  (B3)    │ │  (B4)    │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │   GameEngine     │
                 │     (B4)         │
                 └──────────────────┘
```

### 3.2 开发批次

---

#### Batch 0：基础设施（优先完成，其他批次的基石）

| 步骤 | 任务 | 产出 | 理由 |
|------|------|------|------|
| **B0.1** | 项目初始化 | `package.json` / `tsconfig.json` / `jest.config.js` | 需要编译和测试环境 |
| **B0.2** | 全部类型定义 | `src/core/types.ts` | **最重要的一步**。所有枚举、接口、类型都在此定义。后续所有模块依赖这些类型。根据 Architecture.md §3 和 Card_System.md §2-§4 设计 |
| **B0.3** | EventBus | `src/core/EventBus.ts` | 无依赖，可独立实现。同步事件总线，驱动能力触发 |
| **B0.4** | 工具函数 | `src/utils/*.ts` | shuffle / idgen / logger |
| **B0.5** | 卡牌 JSON Schema | `src/data/schema/card_schema.json` | 定义数据契约 |
| **B0.6** | 关键词定义 | `src/data/keywords/keyword_definitions.json` | 9种关键词 → 等效能力 |

**为什么先做**：types.ts 是全局基础，EventBus 无依赖，这两个可以立刻开始。CardSystem 需要 types，但 types 需要先完成。

---

#### Batch 1：数据与状态（Batch 0 之后）

| 步骤 | 任务 | 产出 | 理由 |
|------|------|------|------|
| **B1.1** | CardSystem | `src/systems/CardSystem.ts` | 加载/验证卡牌JSON → 展开关键词 → CardRegistry。数据是引擎的燃料 |
| **B1.2** | 测试卡牌数据 | `src/data/cards/test_set/*.json` (20张) | 覆盖4种类型 + 全部关键词 + 常见能力模式。**手工编写结构化的能力 JSON** |
| **B1.3** | GameState | `src/core/GameState.ts` | 不可变状态 + 区域管理 + 只读查询 + 状态更新方法 |

**为什么先做 CardSystem 再 GameState**：GameState 中的 `CardInZone` 需要引用 `CardRegistry` 中的卡牌数据。CardSystem 可以独立开发测试（加载JSON、验证、展开关键词）。GameState 的单元测试也需要卡牌数据。

---

#### Batch 2：流程控制（Batch 1 之后）

| 步骤 | 任务 | 产出 | 理由 |
|------|------|------|------|
| **B2.1** | TurnManager | `src/core/TurnManager.ts` | 5阶段状态机 + 阶段内自动动作 + RQ-008 先手限制 |
| **B2.2** | EnergySystem | `src/systems/EnergySystem.ts` | calculateEnergy + canAfford |
| **B2.3** | MovementSystem | `src/systems/MovementSystem.ts` | 移动验证 + 容量超限 + Step关键词 |
| **B2.4** | RuleValidator | `src/core/RuleValidator.ts` | 阶段权限 + 能量/AP + 目标 + 状态检查 |

**为什么这批放一起**：TurnManager 需要 GameState（切换阶段、修改回合数）。EnergySystem 和 MovementSystem 相对简单，可以并行开发。RuleValidator 依赖 TurnManager（知道当前阶段才能检查权限）。

**里程碑 M1**：此时可以跑通"空转回合"——Start → Movement → Main → End（先手跳过Attack），不打出任何卡牌。

---

#### Batch 3：能力与战斗（Batch 2 之后 — 核心难点）

| 步骤 | 任务 | 产出 | 理由 |
|------|------|------|------|
| **B3.1** | AbilitySystem — 基础 | `src/systems/AbilitySystem.ts` | 触发检测 + 条件评估 + 代价支付 + 效果执行器 |
| **B3.2** | AbilitySystem — 队列 | 同上 | 同时发动队列（回合玩家优先 + 归属优先级策略 — RQ-009 默认选项B） |
| **B3.3** | DamageSystem | `src/systems/DamageSystem.ts` | 伤害计算 + 生命卡处理 |
| **B3.4** | TriggerSystem | `src/systems/TriggerSystem.ts` | Trigger 检查 + 可选发动 + 多Trigger顺序 |
| **B3.5** | RaidSystem | `src/systems/RaidSystem.ts` | Raid 验证 + 堆叠 + 状态切换 + 能力分离 |
| **B3.6** | BattleSystem | `src/systems/BattleSystem.ts` | 完整攻击流程（宣言→阻挡→BP结算→伤害→Trigger→结束） |

**为什么这个顺序**：BattleSystem 是整个 MVP 最复杂的模块，它依赖 AbilitySystem（When Attacking/Blocking/Wins）、DamageSystem（直接伤害）、TriggerSystem（翻生命卡）。因此必须把前面的子系统做稳定后再组装 BattleSystem。

**里程碑 M2**：可以打出卡牌 + 发动能力 + 完成一次攻击（含Trigger）。

---

#### Batch 4：集成与测试（Batch 3 之后）

| 步骤 | 任务 | 产出 | 理由 |
|------|------|------|------|
| **B4.1** | ActionSystem | `src/core/ActionSystem.ts` | 统一操作入口：接收Action → RuleValidator → DomainSystem → GameState |
| **B4.2** | GameEngine | `src/core/GameEngine.ts` | 门面类：newGame / startGame / submitAction / getState |
| **B4.3** | 预定义场景脚本 | `src/scenarios/*.ts` | 完整对局、战斗专项、Raid专项、Trigger专项 |
| **B4.4** | 集成测试 | `tests/integration/*.test.ts` | 端到端流程测试 |
| **B4.5** | 入口 REPL | `src/index.ts` | 简单的命令行交互：加载卡牌 → 初始化 → 执行操作 → 打印状态 |

**里程碑 M3**：MVP 完成 — 可以运行完整一局游戏。

---

### 3.3 批次总览

```
Batch 0  ████████░░ 基础设施     ~2天    types / EventBus / 工具 / Schema / 关键词
Batch 1  ████████░░ 数据与状态   ~2天    CardSystem / 测试卡 / GameState
Batch 2  ████████░░ 流程控制     ~2天    TurnManager / Energy / Movement / Validator
Batch 3  ██████████ 能力与战斗   ~4天    Ability / Damage / Trigger / Raid / Battle
Batch 4  ██████░░░░ 集成与测试   ~2天    ActionSystem / GameEngine / Scenarios / 测试
         ─────────
         合计约 12 天
```

---

## 4. 数据结构设计

> 以下 TypeScript 类型定义基于 Architecture.md §3 和 Card_System.md §2-§4。
> MVP 实现时放在 `src/core/types.ts`。

### 4.1 基础枚举

```typescript
// ========== 卡牌类型 ==========
enum CardType {
  CHARACTER = 'Character',
  SITE = 'Site',
  EVENT = 'Event',
  AP = 'AP',
}

// ========== 游戏阶段 ==========
enum GamePhase {
  SETUP = 'Setup',               // 准备阶段（洗牌/抽牌/调度/生命设置）
  START = 'Start',               // 开始阶段
  MOVEMENT = 'Movement',         // 移动阶段
  MAIN = 'Main',                 // 主要阶段
  ATTACK = 'Attack',             // 攻击阶段
  END = 'End',                   // 结束阶段
  GAME_OVER = 'GameOver',        // 游戏结束
}

// ========== 战斗子阶段 ==========
enum BattleStep {
  IDLE = 'Idle',
  ATTACKER_DECLARATION = 'AttackerDeclaration',
  BLOCKER_DECLARATION = 'BlockerDeclaration',
  RESOLVING = 'Resolving',
  ENDING = 'Ending',
}

// ========== 场上状态 ==========
enum FieldState {
  ACTIVE = 'Active',
  RESTING = 'Resting',
}

// ========== 区域 ==========
enum Zone {
  DECK = 'Deck',
  HAND = 'Hand',
  FRONT_LINE = 'FrontLine',
  ENERGY_LINE = 'EnergyLine',
  LIFE_AREA = 'LifeArea',
  AP_AREA = 'ApArea',
  SIDELINE = 'Sideline',
  REMOVAL_AREA = 'RemovalArea',
}

// ========== 能力时机 ==========
enum AbilityTiming {
  WHEN_PLAYED = 'WhenPlayed',
  WHEN_SIDELINED = 'WhenSidelined',
  WHEN_ATTACKING = 'WhenAttacking',
  WHEN_BLOCKING = 'WhenBlocking',
  WHEN_BATTLE_WINS = 'WhenBattleWins',
  WHEN_BATTLE_LOSES = 'WhenBattleLoses',
  WHEN_NOT_BLOCKED = 'WhenNotBlocked',
  START_OF_TURN = 'StartOfTurn',
  END_OF_TURN = 'EndOfTurn',
  START_OF_ATTACK_PHASE = 'StartOfAttackPhase',
  END_OF_BATTLE = 'EndOfBattle',
  ACTIVATE_MAIN = 'ActivateMain',
  TRIGGER = 'Trigger',
  DURING_YOUR_TURN = 'DuringYourTurn',
  DURING_OPPONENT_TURN = 'DuringOpponentTurn',
  DURING_BATTLE = 'DuringBattle',
}

// ========== 效果类型（MVP子集） ==========
enum EffectType {
  // 卡牌移动
  DRAW_CARD = 'DrawCard',
  SIDELINE_CHARACTER = 'SidelineCharacter',
  RETURN_TO_HAND = 'ReturnToHand',
  MOVE_TO_FRONT_LINE = 'MoveToFrontLine',
  MOVE_TO_ENERGY_LINE = 'MoveToEnergyLine',
  // BP修改
  BP_BUFF = 'BpBuff',
  BP_DEBUFF = 'BpDebuff',
  // 状态修改
  SWITCH_TO_ACTIVE = 'SwitchToActive',
  SWITCH_TO_RESTING = 'SwitchToResting',
  PREVENT_ATTACK = 'PreventAttack',
  PREVENT_BLOCK = 'PreventBlock',
  // 关键词授予
  GAIN_KEYWORD = 'GainKeyword',
  LOSE_KEYWORD = 'LoseKeyword',
  NULLIFY_KEYWORD = 'NullifyKeyword',
  // 伤害
  DEAL_DAMAGE = 'DealDamage',
  SET_DAMAGE_MULTIPLIER = 'SetDamageMultiplier',   // Damage 2
  MODIFY_DAMAGE = 'ModifyDamage',                   // Damage +1
  // 复合
  SEQUENCE = 'Sequence',
  CONDITIONAL_EFFECT = 'ConditionalEffect',
}

// ========== 条件类型 ==========
enum ConditionType {
  IF_ON_FRONT_LINE = 'IfOnFrontLine',
  IF_ON_ENERGY_LINE = 'IfOnEnergyLine',
  IF_ACTIVE = 'IfActive',
  IF_RESTING = 'IfResting',
  IF_OPPONENT_HAS_CHARACTER = 'IfOpponentHasCharacter',
  IF_HAND_NOT_EMPTY = 'IfHandNotEmpty',
  IF_NOT_BLOCKED = 'IfNotBlocked',
  IS_FIRST_ATTACK_THIS_TURN = 'IsFirstAttackThisTurn',
  AND = 'And',
  OR = 'Or',
  NOT = 'Not',
}

// ========== 代价类型 ==========
enum CostType {
  SWITCH_TO_RESTING = 'SwitchToResting',
  PAY_AP = 'PayAp',
  SIDELINE_THIS_CARD = 'SidelineThisCard',
  DISCARD_FROM_HAND = 'DiscardFromHand',
}

// ========== 持续时间 ==========
enum Duration {
  INSTANT = 'Instant',
  DURING_BATTLE = 'DuringBattle',
  UNTIL_END_OF_TURN = 'UntilEndOfTurn',
  UNTIL_START_OF_NEXT_TURN = 'UntilStartOfNextTurn',
  WHILE_ON_FIELD = 'WhileOnField',
}

// ========== 目标类型 ==========
enum TargetType {
  CHARACTER = 'Character',
  SITE = 'Site',
  CARD = 'Card',
  PLAYER = 'Player',
  SELF = 'Self',
}

enum Scope {
  SELF = 'Self',
  OPPONENT = 'Opponent',
  ANY = 'Any',
}

// ========== 事件类型 ==========
enum GameEventType {
  GAME_STARTED = 'GameStarted',
  TURN_STARTED = 'TurnStarted',
  PHASE_CHANGED = 'PhaseChanged',
  TURN_ENDED = 'TurnEnded',
  GAME_ENDED = 'GameEnded',

  CARD_PLAYED = 'CardPlayed',
  CARD_SIDELINED = 'CardSidelined',
  CARD_MOVED_TO_ZONE = 'CardMovedToZone',

  ATTACK_DECLARED = 'AttackDeclared',
  BLOCK_DECLARED = 'BlockDeclared',
  BATTLE_RESOLVED = 'BattleResolved',
  BATTLE_WON = 'BattleWon',
  BATTLE_LOST = 'BattleLost',
  CHARACTER_SIDELINED_BY_BATTLE = 'CharacterSidelinedByBattle',

  DAMAGE_DEALT = 'DamageDealt',
  LIFE_CARD_REVEALED = 'LifeCardRevealed',
  TRIGGER_CHECKED = 'TriggerChecked',
  TRIGGER_ACTIVATED = 'TriggerActivated',

  ABILITY_ACTIVATED = 'AbilityActivated',
  ABILITY_RESOLVED = 'AbilityResolved',
}
```

### 4.2 卡牌数据结构（JSON 加载后）

```typescript
// ========== 卡牌基础数据（来自 JSON，不可变） ==========
interface CardData {
  cardId: string;                    // 如 "HTR-1-001"
  cardNumber: string;                // 如 "UA03BT/HTR-1-001"
  cardName: string;
  cardType: CardType;
  sourceMaterial: string;            // 如 "HTR"
  rarity: string;
  requiredEnergy: {
    color: string;                   // 如 "白"
    amount: number;
  };
  apCost: number;
  affinities: string[];              // 如 ["Hunter", "Protagonist"]

  // 角色卡专属
  bp?: {
    base: number;
    hasPlus: boolean;
  };
  energyGeneration?: Array<{
    color: string;
    amount: number;
    hasPlus: boolean;
  }>;

  // Raid
  raid?: {
    hasRaid: true;
    targetSpecifier: {
      type: 'Name' | 'Affinity';
      value: string;
    };
    raidAbilities: AbilityData[];    // RQ-004: 分离存储
  };

  // 能力
  abilities: AbilityData[];          // 普通能力列表（展开关键词后）
  trigger?: AbilityData;             // Trigger 能力（独立）

  // 关键词（原始标记，加载时展开到 abilities）
  keywords: string[];
}

// ========== 能力数据（来自 JSON，不可变） ==========
interface AbilityData {
  abilityId: string;
  timing: AbilityTiming;
  condition?: ConditionData;
  costs: CostData[];
  effects: EffectData[];
  isOncePerTurn: boolean;
  isOptional: boolean;
}

// ========== 条件 ==========
interface ConditionData {
  conditionType: ConditionType;
  params?: Record<string, any>;
  subConditions?: ConditionData[];   // AND / OR / NOT 用
}

// ========== 代价 ==========
interface CostData {
  costType: CostType;
  params?: Record<string, any>;
}

// ========== 效果 ==========
interface EffectData {
  effectType: EffectType;
  target?: TargetDescriptor;
  params?: Record<string, any>;
  subEffects?: EffectData[];         // SEQUENCE / CONDITIONAL_EFFECT 用
  condition?: ConditionData;         // CONDITIONAL_EFFECT 用
}

// ========== 目标描述符 ==========
interface TargetDescriptor {
  targetType: TargetType;
  scope: Scope;
  location: Zone;
  filter?: {
    cardType?: CardType;
    color?: string;
    affinity?: string;
    bpMin?: number;
    bpMax?: number;
    state?: FieldState;
    hasKeyword?: string;
  };
  count: number;
  chooser: 'CONTROLLER' | 'OPPONENT' | 'OWNER';
}

// ========== 展开后的卡牌（CardSystem 加载后，进入引擎的格式） ==========
interface Card {
  cardData: CardData;                // 原始数据引用
  abilities: AbilityData[];          // 展开关键词后的完整能力列表
  trigger?: AbilityData;
}
```

### 4.3 运行时状态

```typescript
// ========== 游戏状态 ==========
interface GameState {
  gameId: string;
  phase: GamePhase;
  turnNumber: number;                // 从1开始
  currentPlayerId: string;
  players: Record<string, PlayerState>;  // playerId → PlayerState
  battleState: BattleState | null;
  abilityQueue: AbilityInstance[];
  stateVersion: number;
  winner: string | null;
}

// ========== 玩家状态 ==========
interface PlayerState {
  playerId: string;
  playerOrder: 'PlayerOne' | 'PlayerTwo';

  deck: CardInZone[];
  hand: CardInZone[];
  frontLine: CardOnField[];          // 最多4张
  energyLine: CardOnField[];         // 最多4张
  lifeArea: CardInZone[];
  apArea: APCardInstance[];
  sideline: CardInZone[];
  removalArea: CardInZone[];

  // 资源缓存
  energyPool: Record<string, number>;
  availableAP: number;
}

// ========== 区域中的卡牌 ==========
interface CardInZone {
  cardId: string;                    // 指向 CardRegistry
  instanceId: string;                // 运行时唯一ID
  ownerId: string;
  faceUp: boolean;
  position: number;                  // 区域内位置 (0-based)
}

// ========== 场上的卡牌 ==========
interface CardOnField extends CardInZone {
  state: FieldState;                 // Active | Resting
  currentBP: number;                 // 当前BP（含所有修正）
  appliedEffects: AppliedEffect[];   // 当前生效的效果
  raidedBy: string | null;           // instanceId of card raiding this one
  raiding: string | null;            // instanceId of card this is stacked on
  enteredFieldThisTurn: boolean;     // 本回合入场（虽RQ-002确认不需要召唤失调，但保留以备其他效果引用）
}

// ========== AP 卡 ==========
interface APCardInstance extends CardInZone {
  state: FieldState;
}

// ========== 已应用的效果 ==========
interface AppliedEffect {
  effectId: string;
  sourceCardId: string;              // instanceId
  sourceAbilityId: string;
  effectType: EffectType;
  params: Record<string, any>;
  duration: Duration;
  turnsRemaining?: number;           // UNTIL_START_OF_NEXT_TURN 用
  phaseExpiry?: GamePhase;           // DURING_BATTLE 等阶段到期
}

// ========== 战斗状态 ==========
interface BattleState {
  step: BattleStep;
  attacker: {
    cardInstanceId: string;
    bpAtDeclaration: number;
  };
  target: {
    type: 'PLAYER' | 'CHARACTER';
    playerId: string;
    characterInstanceId?: string;    // Snipe 时
  };
  blocker: {
    cardInstanceId: string | null;
    bpAtDeclaration: number | null;
  } | null;
  isSnipe: boolean;
  battleEffects: AppliedEffect[];    // "本次战斗中"效果
  damageDealt: number;
}

// ========== 能力实例（队列中） ==========
interface AbilityInstance {
  instanceId: string;
  abilityData: AbilityData;
  sourceCardInstanceId: string;
  sourcePlayerId: string;
  targetSelections?: TargetSelection[];  // 已选择的目标
  isTrigger: boolean;                    // 是否来自Trigger
}

// ========== 目标选择 ==========
interface TargetSelection {
  targetDescriptor: TargetDescriptor;
  selectedInstanceIds: string[];
}
```

### 4.4 事件

```typescript
interface GameEvent {
  eventType: GameEventType;
  timestamp: number;                 // stateVersion
  sourcePlayerId?: string;
  sourceCardInstanceId?: string;
  data: Record<string, any>;
}
```

### 4.5 操作请求与结果

```typescript
// ========== 操作类型 ==========
enum ActionType {
  PLAY_CHARACTER = 'PlayCharacter',
  PLAY_SITE = 'PlaySite',
  USE_EVENT = 'UseEvent',
  PERFORM_RAID = 'PerformRaid',
  ACTIVATE_ABILITY = 'ActivateAbility',
  MOVE_CHARACTER = 'MoveCharacter',
  DECLARE_ATTACK = 'DeclareAttack',
  DECLARE_BLOCK = 'DeclareBlock',
  ACTIVATE_TRIGGER = 'ActivateTrigger',
  EXTRA_DRAW = 'ExtraDraw',
  END_MAIN_PHASE = 'EndMainPhase',
  END_ATTACK_PHASE = 'EndAttackPhase',
  MULLIGAN_DECISION = 'MulliganDecision',
  SELECT_TARGET = 'SelectTarget',    // 需要选择目标时
}

interface ActionRequest {
  actionType: ActionType;
  playerId: string;
  cardInstanceId?: string;           // 要使用的卡牌
  targetInstanceId?: string;         // 目标
  targetZone?: Zone;                 // 目标区域
  abilityId?: string;                // 要发动的能力ID
  selections?: Record<string, any>;  // 目标选择结果
}

interface ActionResult {
  success: boolean;
  error?: string;
  newState: GameState;
  events: GameEvent[];
  pendingOptions?: ActionRequest[];  // 需要进一步选择（如Trigger 可选发动、选择目标）
  log: string[];
}
```

### 4.6 CardRegistry

```typescript
interface CardRegistry {
  byId: Map<string, Card>;
  byType: Map<CardType, Card[]>;
  bySource: Map<string, Card[]>;
  all: Card[];
  keywords: Map<string, AbilityData[]>;  // 关键词 → 展开的能力列表
}
```

---

## 5. 测试方案

### 5.1 测试策略

```
         ┌──────────────────────────────────┐
         │       E2E / Scenario Tests        │  ← 完整对局流程
         │   full_game.test.ts               │
         │   scenarios/*.ts                  │
         └──────────────┬───────────────────┘
                        │
         ┌──────────────┴───────────────────┐
         │       Integration Tests           │  ← 跨模块交互
         │   full_turn / battle_flow         │
         │   trigger_chain / raid_flow       │
         └──────────────┬───────────────────┘
                        │
         ┌──────────────┴───────────────────┐
         │         Unit Tests                │  ← 每个模块独立
         │   每个 systems/ 和 core/ 模块      │
         │   的独立 .test.ts 文件             │
         └──────────────────────────────────┘
```

### 5.2 测试框架

- **测试运行器**：Jest（或 Vitest，更快的 TypeScript 支持）
- **断言库**：Jest 内置
- **测试数据**：`tests/fixtures/` 中的工厂函数

### 5.3 单元测试用例（按模块）

#### CardSystem

| 测试用例 | 验证点 |
|---------|--------|
| 加载合法卡牌 JSON → 正确解析 | CardData 字段完整性 |
| 加载非法卡牌 JSON → 抛出验证错误 | Schema 验证 |
| 关键词展开：Snipe → 2条等效能力 | 展开正确性 |
| 关键词展开：Impact 1 → 战斗获胜时伤害 | 展开正确性 |
| Raid 卡 raidAbilities 与 abilities 分离 | RQ-004 数据分离 |
| 按类型/cardId查询 | CardRegistry 索引 |
| hasPlus 标记正确保留 | RQ-005 语义 |

#### GameState

| 测试用例 | 验证点 |
|---------|--------|
| 新游戏状态创建 | 全区域初始化正确 |
| 卡牌从手牌移动到前线 | 区域变更 + 实例追踪 |
| 不可变更新：旧状态不变 | 状态快照隔离 |
| 前线和能量线容量=4 | 容量限制 |
| 资源缓存（energyPool, availableAP）自动更新 | 缓存一致性 |
| 胜负判定：生命区为空 | winner 设置 |

#### TurnManager

| 测试用例 | 验证点 |
|---------|--------|
| 阶段流转：Start → Movement → Main → Attack → End | 5阶段顺序 |
| Start Phase：清除效果 → Active → AP调整 → 抽牌 | 自动动作 |
| Player One Turn 1 跳过 Attack Phase | RQ-008 |
| Player Two Turn 1 有 Attack Phase | RQ-008 逆向验证 |
| AP 数量：P1 T1=1, P1 T2=2, P1 T3+=3 | AP表正确 |
| AP 数量：P2 T1=2 | AP表正确 |
| End Phase：手牌上限检查 | 超8张需弃牌 |
| 额外抽牌：每回合仅1次 | 次数限制 |
| 先手第一回合 Start Phase 不抽牌 | 强制抽牌规则 |

#### EnergySystem

| 测试用例 | 验证点 |
|---------|--------|
| 能量线汇总：多张卡同颜色 | 颜色合并 |
| 能量线汇总：不同颜色 | 独立汇总 |
| canAfford：能量足够 | true |
| canAfford：数量不足 | false |
| canAfford：颜色不匹配 | false |
| 前线卡牌不参与能量计算 | 区域过滤 |

#### MovementSystem

| 测试用例 | 验证点 |
|---------|--------|
| 能量线→前线：正常移动 | 区域变更 + Active状态保持 |
| 前线满4张→移动触发移除 | 容量超限 |
| 只能在 Movement Phase 移动 | 阶段权限 |
| Step 关键词允许逆行移动 | 关键词效果 |
| Site 卡不可移动 | 类型限制 |

#### AbilitySystem

| 测试用例 | 验证点 |
|---------|--------|
| When Played 触发：打出角色卡 | 触发检测 + 效果执行 |
| When Played 不触发：Raid 普通打出（raidAbilities 分离） | RQ-004 |
| 条件评估：IF_ON_FRONT_LINE → true | 条件满足 |
| 条件评估：IF_ON_FRONT_LINE → false | 条件不满足跳过 |
| 代价支付：Switch to Resting | Active→Resting |
| 代价支付：原子性（部分支付失败→全部不付） | 原子性 |
| 效果执行：DrawCard | 手牌+1, 牌库-1 |
| 效果执行：BP_BUFF | currentBP 变化 |
| 效果执行：SwitchToResting | 目标Active→Resting |
| 同时发动队列：回合玩家优先 | 排序规则 |
| 同时发动队列：归属优先级（新能力优先级保持） | RQ-009 默认B |
| Activate: Main：手动发动 | 手动触发 |
| Activate: Main：代价不足不可发动 | 代价检查 |
| 效果组合：Sequence 顺序执行 | 复合效果 |

#### BattleSystem

| 测试用例 | 验证点 |
|---------|--------|
| 攻击宣言：Active角色→Resting | 状态切换 |
| 攻击宣言：非Active角色不可攻击 | 状态检查 |
| 阻挡宣言：Active角色→Resting | 状态切换 |
| Snipe 攻击：可选角色为目标 | 目标选择 |
| Snipe 攻击：不可阻挡 | 跳过阻挡步骤 |
| BP比较：攻方BP > 目标BP → Sideline | 分支A |
| BP比较：攻方BP = 目标BP → 攻方胜 | 相等规则 |
| BP比较：攻方BP < 目标BP → 攻方战败 | 分支B |
| 直接伤害（未被阻挡）：翻生命卡1张 | 伤害流程 |
| Damage 2：翻生命卡2张 | 关键词效果 |
| Impact 1：战斗获胜后额外1点伤害 | 关键词效果 |
| Double Attack：首次攻击后恢复Active | 关键词效果 |
| When Attacking 能力触发 | 战斗时机能力 |
| When Blocking 能力触发 | 战斗时机能力 |
| 无 Active 角色时 Attack Phase 结束 | 边界情况 |

#### DamageSystem

| 测试用例 | 验证点 |
|---------|--------|
| 1点伤害：选1张生命卡→翻开 | 基础伤害 |
| Damage 2：2点伤害同时翻开2张 | 多点伤害 |
| 伤害来源追踪 | 来源记录 |

#### TriggerSystem

| 测试用例 | 验证点 |
|---------|--------|
| 翻到有Trigger的卡→可选发动 | Trigger 检查 |
| 选择发动→结算效果→Sideline | Trigger 结算 |
| 选择不发动→直接Sideline | Trigger 跳过 |
| 无Trigger卡→直接Sideline | 无Trigger处理 |
| 2点伤害翻2张都有Trigger→任意顺序结算 | 多Trigger顺序 |
| Attack Phase 中 Trigger 正常发动 | RQ-007 |

#### RaidSystem

| 测试用例 | 验证点 |
|---------|--------|
| Raid 打出：目标匹配→堆叠→Active→When Played | 完整流程 |
| Raid 目标不在场上→无法打出 | 目标验证 |
| 普通打出Raid卡：raidAbilities不生效 | RQ-004 |
| Raid卡离开场上：顶层去目标区+底层Sideline | 堆叠清理 |
| 底层卡能力失效 | RQ-004 运行时验证 |

### 5.4 集成测试用例

#### 完整回合测试

```
测试场景：Player One Turn 2 完整回合
  1. Start Phase：清除效果 → Active → AP=2 → 抽1张
  2. Movement Phase：移动1角色到前线
  3. Main Phase：打出1张角色卡到前线 + 发动1次Activate: Main能力
  4. Attack Phase：1次攻击（被阻挡→BP比较→Sideline）
  5. End Phase：Active切换 → 手牌上限检查
  验证：所有状态变更正确，事件触发正确
```

#### 战斗流程集成测试

```
测试场景：Snipe攻击 → 额外效果 → Impact
  1. Player One Main Phase: 打出Snipe角色到前线
  2. Movement Phase (下一回合): 移动到前线
  3. Attack Phase: Snipe攻击对方前线角色
  4. 不可阻挡 → BP比较胜利 → Sideline目标 → Impact 1伤害
  5. 伤害翻生命卡 → Trigger检查 → 结算/不结算
  验证：完整攻击链 + Trigger 链
```

#### Trigger 链测试

```
测试场景：Damage 2 造成2点伤害，2张生命卡都有Trigger
  1. 攻击未被阻挡 → Damage 2 → 2点伤害
  2. 选2张生命卡→同时翻开
  3. 防御方选择Trigger结算顺序
  4. 第1张Trigger结算（Draw 1）→ Sideline
  5. 第2张Trigger结算（Deal Damage 1）→ Sideline
  验证：多Trigger顺序 + 新效果插入队列
```

#### Raid 流程测试

```
测试场景：普通打出角色 → 下回合 Raid 叠加
  1. Turn 1: Player One 打出角色A 到前线 (Resting)
  2. Turn 2: Start Phase → 角色A Resting→Active
  3. Main Phase: Raid打出角色B，堆叠在角色A上
  4. 角色B Active → 可选移至前线 → When Played 触发
  5. 同一回合 Attack Phase: 角色B 可以攻击
  验证：Raid全流程 + RQ-002（Raid后可攻击）
```

### 5.5 端到端测试

```
测试场景：完整一局游戏（脚本驱动）
  1. 双方各50张测试卡组 + 3AP
  2. 洗牌 → 抽7 → 调度 → 放生命区7张
  3. 循环回合直到一方胜利
  4. 覆盖：打牌/Raid/攻击/阻挡/Trigger/能力/胜负
  验证：完整游戏流程无崩溃，规则正确
```

### 5.6 测试卡牌设计原则

20 张测试卡需要覆盖：

| 覆盖维度 | 卡牌数量 | 说明 |
|---------|---------|------|
| Character 卡 | ~10张 | 不同BP/能量/关键词/能力组合 |
| Site 卡 | ~3张 | 带/不带能力 |
| Event 卡 | ~4张 | 不同效果 + Trigger |
| Raid 卡 | ~3张 | 不同 targetSpecifier + raidAbilities |

**关键词覆盖**：Step / Snipe / Double Attack / Damage 2 / Impact 1 / Nullify Impact

**能力覆盖**：When Played / Activate: Main / When Attacking / When Blocking / Trigger / 持续性效果

---

## 附录：MVP 与完整架构的差异总结

| 维度 | 完整架构 (Architecture.md) | MVP |
|------|--------------------------|-----|
| 模块数 | 16 | 13 (推迟3个) |
| StateHistory | 完整快照/增量/Replay | console.log |
| DeckBuilder | 完整验证 + UI | 手动检查 |
| AbilitySystem | 6大类效果 + DSL解析 | 4大类效果 + 直接JSON |
| 效果子类型 | ~30种 | ~15种（MVP需要） |
| Duration 类型 | 8种 | 5种 |
| 目标选择 | 完整筛选器 | 简化筛选 |
| Once Per Turn | 完整追踪 | 推迟 |
| RQ-009 | 待查证 | 默认选项B |
| UI | Phaser 前端 | 无 |
| AI | 规则型AI | 无 |

---

> **关联文档**：
> - `Architecture.md` — 完整模块设计
> - `Card_System.md` — 卡牌数据结构详细参考
> - `Battle_System.md` — 战斗流程详细参考
> - `Game_Design.md` — 回合/阶段/AP/区域
> - `Rule_Resolution.md` — 9条规则裁决
> - `Rule_Impact_Report.md` — 裁决对系统的影响
