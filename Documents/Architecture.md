# Union Arena Digital — 核心规则引擎架构设计

> 版本：1.0
> 最后更新：2026-08-03
> 设计阶段：阶段 2（核心规则引擎）
>
> 本文档定义 Union Arena 数字版核心规则引擎的模块架构、数据流、状态设计和扩展方案。
> 基于官方规则手册 Ver1.1 及阶段 1 全部设计文档。

---

## 目录

1. [总体架构](#1-总体架构)
2. [模块职责](#2-模块职责)
3. [游戏状态设计](#3-游戏状态设计)
4. [数据流设计](#4-数据流设计)
5. [卡牌扩展设计](#5-卡牌扩展设计)
6. [效果系统设计](#6-效果系统设计)
7. [后续开发路线](#7-后续开发路线)
8. [架构评估](#8-架构评估)

---

## 1. 总体架构

### 1.1 设计理念

Union Arena 核心规则引擎采用 **事件驱动 + 状态机** 架构。核心理念：

- **游戏是一系列状态转换** — 每次操作将游戏从一个合法状态转换到另一个合法状态
- **能力系统是事件消费者** — 游戏事件触发能力，能力产生效果，效果产生新事件
- **规则与执行分离** — 规则验证层独立于状态变更层
- **卡牌数据与引擎逻辑完全解耦** — 引擎只解释数据，不理解单张卡牌

### 1.2 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         API / Facade Layer                       │
│                         GameEngine (Facade)                      │
│              对外唯一入口，封装整个规则引擎的复杂度                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Action      │    │   Turn        │    │   GameState   │
│   System      │    │   Manager     │    │   (Store)     │
│   (输入层)    │    │   (流程控制)   │    │   (状态层)    │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Rule        │    │   Event       │    │   State       │
│   Validator   │    │   Bus         │    │   History     │
│   (规则检查)  │    │   (事件总线)   │    │   (可追溯)    │
└───────┬───────┘    └───────┬───────┘    └───────────────┘
        │                    │
        ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Systems (领域系统层)                  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Card    │  │  Energy  │  │  Ability │  │  Battle  │        │
│  │  System  │  │  System  │  │  System  │  │  System  │        │
│  │ (卡牌管理)│  │ (能量计算)│  │ (能力结算)│  │ (战斗结算)│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Movement │  │  Damage  │  │ Trigger  │  │  Raid    │        │
│  │  System  │  │  System  │  │  System  │  │  System  │        │
│  │ (移动管理)│  │ (伤害结算)│  │ (触发检查)│  │ (Raid管理)│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer (数据层)                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Card    │  │  Keyword │  │  Ability │  │  Deck    │        │
│  │  JSON    │  │  Defs    │  │  Schema  │  │  Builder │        │
│  │ (卡牌数据)│  │ (关键词库)│  │ (能力模板)│  │ (卡组构筑)│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 架构总览图（模块关系）

```
                         ┌─────────────┐
                         │  GameEngine │
                         │   (Facade)  │
                         └──────┬──────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │ ActionSystem │    │ TurnManager  │    │  GameState   │
    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
           │                   │                    │
           │  ┌────────────────┼────────────────┐   │
           │  │                │                │   │
           ▼  ▼                ▼                ▼   ▼
    ┌──────────────────────────────────────────────────┐
    │                 EventBus                         │
    │  ON_ACTION_VALIDATED  ON_PHASE_CHANGE            │
    │  ON_CARD_PLAYED       ON_STATE_CHANGED           │
    │  ON_ATTACK_DECLARED   ON_DAMAGE_DEALT   ...      │
    └──────────────────────┬───────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │   Ability    │ │   Battle     │ │   Trigger    │
    │   Resolver   │ │   Resolver   │ │   Resolver   │
    └──────────────┘ └──────────────┘ └──────────────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  GameState   │
                    │  (Mutated)   │
                    └──────────────┘
```

### 1.4 模块清单

| 序号 | 模块名 | 类型 | 一句话描述 |
|------|--------|------|-----------|
| M1 | **GameEngine** | Facade | 对外统一入口，编排各子系统 |
| M2 | **GameState** | Store | 游戏全部运行时状态的单一数据源 |
| M3 | **TurnManager** | Controller | 回合与5阶段状态机 |
| M4 | **ActionSystem** | Controller | 接收并处理所有玩家操作请求 |
| M5 | **RuleValidator** | Service | 集中化的规则合法性检查 |
| M6 | **EventBus** | Infrastructure | 游戏事件发布/订阅，驱动能力触发 |
| M7 | **CardSystem** | Service | 卡牌数据加载、验证、关键词展开 |
| M8 | **EnergySystem** | Service | 能量生成汇总与颜色匹配 |
| M9 | **AbilitySystem** | Service | 能力触发检测、条件评估、代价支付、效果执行 |
| M10 | **BattleSystem** | Service | 攻击阶段流程与战斗结算 |
| M11 | **MovementSystem** | Service | Movement Phase 角色移动与容量管理 |
| M12 | **DamageSystem** | Service | 伤害计算与生命区处理 |
| M13 | **TriggerSystem** | Service | 生命触发检查与结算 |
| M14 | **RaidSystem** | Service | Raid 机制管理与堆叠状态 |
| M15 | **StateHistory** | Infrastructure | 状态变更日志，支持回溯与 replay |
| M16 | **DeckBuilder** | Service | 卡组构筑规则验证 |

---

## 2. 模块职责

### 2.1 GameEngine（游戏引擎门面）

**定位**：整个规则引擎的唯一对外入口。无论是 AI、网络对战服务器、还是未来任何调用方，都只通过 GameEngine 与引擎交互。

**职责**：
- 游戏生命周期管理：`newGame()` / `startGame()` / `endGame()`
- 接收玩家操作请求并路由到 ActionSystem
- 查询当前游戏状态（只读）
- 管理各子系统的初始化和协调
- 持有 GameState、TurnManager、EventBus 的引用

**接口概要**：
```
newGame(config)        → GameID
startGame(gameId)      → void
getState(gameId)       → GameState (readonly)
submitAction(gameId, action) → ActionResult
getValidActions(gameId) → Action[]
endGame(gameId)        → GameResult
```

**不负责**：
- 不执行具体规则检查（委托给 RuleValidator）
- 不直接修改 GameState（委托给 ActionSystem）
- 不处理 UI / 渲染 / 网络

---

### 2.2 GameState（游戏状态存储器）

**定位**：游戏全部运行时数据的单一数据源（Single Source of Truth）。采用不可变快照模式，每次状态变更产生新的 State 对象。

**职责**：
- 存储全部游戏数据（详见第3节）
- 提供只读查询接口
- 通过 ActionSystem 进行受控的不可变更新
- 每次变更自动推送事件到 EventBus
- 支持状态快照（用于 rollback / replay）

**接口概要**：
```
getPlayer(playerId)    → PlayerState
getZone(playerId, zone) → Card[]
getTurnInfo()          → TurnInfo
getBattleState()       → BattleState | null
getPhase()             → Phase
canAfford(playerId, card) → boolean
```

**不负责**：
- 不自行决定状态变更（变更由 ActionSystem 发起）
- 不包含规则判断逻辑

---

### 2.3 TurnManager（回合管理器）

**定位**：控制游戏回合与阶段的流转。是一个严格的有限状态机。

**职责**：
- 管理回合计数器（当前第几回合、当前玩家）
- 管理阶段状态机：`Start → Movement → Main → Attack → End`
- 阶段权限控制：每个阶段限制允许的操作类型
- 自动执行阶段内定时动作：
  - Start Phase：清除过期效果 → 全转 Active → 调整 AP → 强制抽牌
  - End Phase：效果结算 → 全转 Active → 手牌上限检查 → 清除过期效果
- 管理回合切换（Player A ↔ Player B）
- 管理 AP 数量表（Turn 1/2/3+ 的先手/后手差异）
- **先手第一回合限制**（RQ-008 确认）：Player One 的第一回合不可进入 Attack Phase。Main Phase 结束后直接进入 End Phase。先手第一回合可以正常使用卡牌和发动能力，AP 可用于打牌或额外抽牌（二选一，因为只有 1 张 AP）。

**状态机模型**：

```
┌──────────┐   Start    ┌──────────┐  Movement  ┌──────────┐
│  START   │───────────→│ MOVEMENT │───────────→│   MAIN   │
│  PHASE   │            │  PHASE   │            │  PHASE   │
└──────────┘            └──────────┘            └────┬─────┘
     ▲                                               │
     │                                      player chooses
     │                                      to enter attack
     │                                               │
     │                                    ┌──────────▼──────────┐
     │                                    │     ATTACK PHASE    │
     │                                    │  (循环直到无攻击)    │
     │                                    └──────────┬──────────┘
     │                                               │
     │                                    player ends / no attackers
     │                                               │
     └───────────────────────────────────────────────┘
                         │
                    ┌──────────┐
                    │   END    │
                    │  PHASE   │
                    └────┬─────┘
                         │
                    switch player
                         │
                         ▼
                   (对手的 Start Phase)
```

**各阶段允许的操作**：

| 操作 | Start | Movement | Main | Attack | End |
|------|-------|----------|------|--------|-----|
| 使用卡牌（打出角色/Site/Event） | ❌ | ❌ | ✅ | ❌ | ❌ |
| 发动 Activate: Main 能力 | ❌ | ❌ | ✅ | ❌ | ❌ |
| 移动角色（能量线→前线） | ❌ | ✅ | ❌ | ❌ | ❌ |
| 攻击宣言 | ❌ | ❌ | ❌ | ✅ | ❌ |
| 额外抽牌（支付1AP） | ✅ | ❌ | ❌ | ❌ | ❌ |
| 进入下一阶段（手动） | 自动 | 自动 | ✅ | ✅ | 自动 |

**不负责**：
- 不执行卡牌效果（委托给 AbilitySystem）
- 不处理战斗结算（委托给 BattleSystem）

---

### 2.4 ActionSystem（操作处理系统）

**定位**：接收所有玩家操作请求，经过验证后执行并更新状态。是"输入 → 状态变更"的核心管道。

**职责**：
- 接收操作请求（打牌、攻击、发动能力、移动角色等）
- 调用 RuleValidator 进行合法性检查
- 调用对应领域系统执行操作
- 将状态变更应用到 GameState
- 返回操作结果（成功/失败/可选操作列表）

**支持的操作类型**：

| 操作 | 允许阶段 | 描述 |
|------|---------|------|
| `PLAY_CHARACTER` | Main | 打出一张角色卡到前线或能量线 |
| `PLAY_SITE` | Main | 打出一张Site卡到能量线 |
| `USE_EVENT` | Main | 使用一张Event卡 |
| `PERFORM_RAID` | Main | 以Raid方式打出一张角色卡 |
| `ACTIVATE_ABILITY` | Main | 发动场上卡的 Activate: Main 能力 |
| `MOVE_CHARACTER` | Movement | 能量线→前线（或 Step 逆向） |
| `DECLARE_ATTACK` | Attack | 攻击宣言 |
| `DECLARE_BLOCK` | Attack | 阻挡宣言 |
| `ACTIVATE_TRIGGER` | Attack (Trigger检查时) | 发动Trigger能力 |
| `EXTRA_DRAW` | Start | 支付1AP额外抽牌 |
| `END_MAIN_PHASE` | Main | 进入攻击阶段 |
| `END_ATTACK_PHASE` | Attack | 结束攻击阶段 |
| `MULLIGAN_DECISION` | 准备阶段 | 调度决定 |

**处理流程**（详见第4节数据流）：

```
Action Request
  → RuleValidator.validate(action, gameState)
  → (if invalid) return Error
  → DomainSystem.execute(action, gameState)
  → GameState.apply(changes)
  → EventBus.emit(events)
  → (check for triggered abilities)
  → return ActionResult
```

**不负责**：
- 不自行判断规则（委托 RuleValidator）
- 不直接操作 GameState 内部结构（通过 GameState 提供的变更方法）

---

### 2.5 RuleValidator（规则验证器）

**定位**：集中化的规则合法性检查。所有规则判断集中在此模块，避免规则散落各处。

**职责**：
- 验证操作是否在当前阶段允许
- 验证卡牌使用条件（能量、AP、目标合法性）
- 验证攻击条件（角色状态、Snipe目标等）
- 验证阻挡条件
- 验证能力发动条件（代价可支付、Once Per Turn等）
- 验证卡组构筑合法性

**验证分类**：

```
RuleValidator
├── PhaseRules        : 阶段权限检查
├── EnergyRules       : 能量需求满足检查
├── APRules           : AP 可用性检查
├── ZoneRules         : 区域容量限制检查
├── StateRules        : Active/Resting 状态检查
├── TargetRules       : 目标合法性检查
├── ConditionRules    : 能力发动条件检查
├── CostRules         : 代价可支付性检查
├── BattleRules       : 攻击/阻挡合法性检查
└── DeckRules         : 卡组构筑规则检查
```

**不负责**：
- 不执行状态变更（只管"能不能做"）
- 不结算效果

---

### 2.6 EventBus（事件总线）

**定位**：游戏事件的核心分发机制。所有状态变更产生事件，能力系统监听事件并触发对应能力。

**职责**：
- 管理事件的发布与订阅
- 事件优先级排序（按规则：回合玩家优先）
- 事件传播范围控制
- 事件日志记录

**核心事件类型**：

```
游戏流程事件：
  GAME_STARTED           游戏开始
  TURN_STARTED           回合开始
  PHASE_CHANGED          阶段切换
  TURN_ENDED             回合结束
  GAME_ENDED             游戏结束

卡牌使用事件：
  CARD_PLAYED            卡牌被打出
  CARD_SIDELINED         卡牌被Sidelined
  CARD_RETURNED_TO_HAND  卡牌返回手牌
  CARD_PLACED_IN_REMOVAL 卡牌进入移除区
  CARD_MOVED_TO_ZONE     卡牌移动到区域

战斗事件：
  ATTACK_DECLARED        攻击宣言
  BLOCK_DECLARED         阻挡宣言
  BATTLE_RESOLVED        战斗结算完成
  BATTLE_WON             战斗获胜
  BATTLE_LOST            战斗战败
  CHARACTER_SIDELINED_BY_BATTLE  角色因战斗被Sidelined

伤害事件：
  DAMAGE_DEALT           伤害造成
  LIFE_CARD_REVEALED     生命卡被翻开
  TRIGGER_CHECKED        Trigger检查完成
  TRIGGER_ACTIVATED      Trigger被发动

能力事件：
  ABILITY_ACTIVATED      能力被发动
  ABILITY_RESOLVED       能力结算完成
  CONDITIONAL_ABILITY_TRIGGERED  条件能力被触发
```

**事件 → 能力触发映射**（部分示例）：

| 事件 | 可能触发的能力 |
|------|--------------|
| `CARD_PLAYED` | When Played |
| `CARD_SIDELINED` / `CHARACTER_SIDELINED_BY_BATTLE` | When Sidelined |
| `ATTACK_DECLARED` | When Attacking |
| `BLOCK_DECLARED` | When Blocking |
| `PHASE_CHANGED` → Attack | Start of Attack Phase 能力 |
| `TURN_STARTED` | Start of Turn 持续性效果 |
| `TURN_ENDED` | End of Turn 清理 |
| `BATTLE_WON` | Impact / 战斗获胜时能力 |
| `BATTLE_LOST` | 攻击战败时能力 |

**不负责**：
- 不决定哪些能力触发（由 AbilitySystem 监听后自行判断）

---

### 2.7 CardSystem（卡牌管理系统）

**定位**：卡牌数据的加载、验证、注册和关键词展开。确保所有卡牌数据在进入引擎前是完整、合法、结构化的。

**职责**：
- 加载卡牌 JSON 数据文件
- 验证卡牌数据完整性（必填字段、类型约束、数据格式）
- 展开关键词为等效能力条目
- 注册卡牌到全局 CardRegistry
- 提供卡牌查询接口（按 ID、按类型、按来源等）
- 支持按卡包分批加载

**卡牌加载管道**：

```
Card JSON File
  → Schema Validation（字段校验）
  → Keyword Expansion（关键词 → 能力条目）
  → Canonicalization（标准化，如 BP值归一化）
  → CardRegistry.register()
  → 卡牌可用于游戏
```

**关键词展开**（参考 Card_System.md §7.2 方案A）：

所有关键词在加载时预展开为等效的能力条目，引擎运行时不需要区分"关键词效果"和"能力效果"。

```
"Snipe" 展开为：
  能力1: timing=WHEN_ATTACKING, effect=ALLOW_TARGET_CHARACTER + effect=PREVENT_BLOCK

"Impact 1" 展开为：
  能力1: timing=WHEN_BATTLE_WINS, effect=DEAL_DAMAGE(amount=1)

"Damage 2" 展开为：
  能力1: timing=WHEN_NOT_BLOCKED, effect=SET_DAMAGE_MULTIPLIER(amount=2)
```

**不负责**：
- 不处理卡牌在游戏中的运行时状态（由 GameState 管理）
- 不执行卡牌能力（由 AbilitySystem 执行）

---

### 2.8 EnergySystem（能量计算系统）

**定位**：计算玩家当前可用的能量资源，判断卡牌是否可支付。

**职责**：
- 实时汇总能量线上各卡的能量生成（按颜色）
- 处理能量生成增减效果（`hasPlus` 标记相关）
- 能量需求匹配检查：`canAfford(card, playerId) → boolean`
- 提供当前能量详情：`getEnergyPool(playerId) → { color: amount }`

**能量计算公式**：

```
For each card on Energy Line:
  totalEnergy[card.energyGeneration.color] += card.energyGeneration.amount
  + abilityModifiers (因效果产生的增减)

canAfford(card):
  return totalEnergy[card.requiredEnergy.color] >= card.requiredEnergy.amount
```

**不负责**：
- 不处理 AP 消耗（AP 是独立系统，由 GameState 管理）
- 不修改能量线上的卡牌

---

### 2.9 AbilitySystem（能力结算系统）

**定位**：整个引擎中最复杂的子系统。负责能力的触发检测、条件评估、代价支付、效果执行和同时发动队列管理。

**职责**：
- **TriggerDetection**：监听 EventBus，匹配已注册能力的 timing 并触发
- **ConditionEvaluator**：评估能力的 condition 是否满足
- **CostPayer**：原子性支付能力的代价（全部满足才支付）
- **EffectExecutor**：执行效果列表（详见第6节效果系统设计）
- **AbilityQueue**：管理同时发动能力的队列与优先级
- **OncePerTurnTracker**：追踪每张卡每回合的能力使用记录
- **DurationManager**：管理持续性效果的创建、追踪和到期清除

**同时发动队列规则**（基于规则手册 Ver1.1）：

```
当多个能力同时发动时：
  1. 将所有触发的能力加入队列
  2. 回合玩家选择其所有能力的结算顺序
  3. 回合玩家的能力全部结算完毕
  4. 非回合玩家选择其所有能力的结算顺序
  5. 非回合玩家的能力全部结算完毕
  6. 结算过程中新触发的能力加入未结算队列
     → 可选择在任意位置插入（按规则：any order desired）
```

**能力队列数据结构示意**：

```
AbilityQueue {
  pending: AbilityInstance[]    // 待结算的能力实例
  turnPlayer: PlayerId          // 当前回合玩家
  currentBatch: 'turn' | 'non-turn' | 'new'
}
```

**持续性效果管理**：

```
DurationManager 追踪每个持续性效果的：
  - effectId: 唯一标识
  - source: 来源卡牌/能力
  - target: 影响目标
  - type: buff/debuff/keyword_grant/state_change/...
  - expiry: 到期时机（phase_change / turn_end / turn_start / battle_end）
  - onExpiry: 到期时的清理动作

生命周期：
  Create → Apply → (持续期间可查询) → Expiry check → Cleanup
```

**不负责**：
- 不决定效果的合法性（由 RuleValidator 在条件评估前检查）
- 不执行战斗结算（由 BattleSystem 处理）

---

### 2.10 BattleSystem（战斗结算系统）

**定位**：管理完整的 Attack Phase 流程，包括攻击宣言、阻挡宣言、BP比较、伤害结算和战斗收尾。

**职责**：
- 管理单次战斗的完整生命周期
- 攻击宣言验证与执行（角色→Resting、Snipe目标选择）
- 阻挡宣言验证与执行
- BP 比较与胜负判定
- 战斗分支结算：
  - 分支A（攻方胜）：Sideline 防御角色 → Impact → 战斗获胜能力
  - 分支B（攻方败）：攻击战败能力 → 防御方战斗获胜能力
- 直接伤害结算（未被阻挡时）
- Double Attack / Double Block 处理
- 管理"本次战斗中"持续性效果的创建与清除

**战斗状态机**：

```
ATTACK_PHASE_IDLE
  │
  ├─ (选择Active角色攻击)
  ▼
ATTACKER_DECLARED  ──→ When Attacking 能力结算
  │
  ├─ (Snipe攻击) ──→ 跳过阻挡
  ├─ (防御方选择是否阻挡)
  ▼
BLOCKER_DECLARED / NO_BLOCK
  │
  ├─ (有阻挡) When Blocking 能力结算
  ├─ (无阻挡) 未被阻挡时能力结算
  ▼
BATTLE_RESOLVING
  │
  ├─ (角色 vs 角色) → BP比较 → 分支A或B
  ├─ (角色 vs 玩家) → 伤害计算 → Trigger检查
  ▼
BATTLE_ENDING  ──→ 战斗结束能力结算
  │              → 清除"本次战斗中"效果
  │              → Double Attack/Double Block 恢复Active
  ▼
ATTACK_PHASE_IDLE
  │
  └─ (继续攻击 / 结束攻击阶段)
```

**BP比较规则**（来自规则手册）：
- 攻击方 BP **≥** 目标 BP → 攻击方获胜（注意：相等也是攻方胜）
- 攻击方 BP **<** 目标 BP → 攻击方战败
- 战斗不改变双方 BP 值

**不负责**：
- 不处理伤害的 Trigger 检查（由 TriggerSystem 处理）
- 不处理 Sideline 触发的能力链（由 AbilitySystem 通过 EventBus 处理）

---

### 2.11 MovementSystem（移动管理系统）

**定位**：管理 Movement Phase 中的角色移动和容量超限处理。

**职责**：
- 验证移动合法性（源/目标区域、容量、Step关键词等）
- 执行同时移动（Movement Phase 中所有移动同时发生）
- 容量超限处理：目标满4张时，为每个移入角色移除目标线1张卡
- Step 关键词：允许前线→能量线逆向移动
- Step 满位交换：逆向移动目标满时，可选择交换位置（而非移除）
- 非 Movement Phase 的移动（如效果导致）也使用相同容量规则

**移动规则矩阵**：

| 源 → 目标 | 条件 | 容量超限处理 |
|-----------|------|-------------|
| 能量线 → 前线 | Movement Phase / 效果 | 目标满→移除目标线1张 |
| 前线 → 能量线 | 需要 Step 关键词 | 目标满→交换位置 或 移除目标线1张 |
| Site 移动 | ❌ 禁止 | N/A |

**不负责**：
- 不处理效果导致的移动触发（由 AbilitySystem 通过 EventBus 触发 When Sidelined 等）

---

### 2.12 DamageSystem（伤害计算系统）

**定位**：处理伤害点数计算、伤害应用和生命卡翻开。

**职责**：
- 伤害点数计算（默认1 + Damage 2/ Damage +1 修正）
- Impact 伤害计算
- 多点伤害时生命卡的选择与翻开
- 伤害来源追踪（用于效果引用）

**伤害类型与计算**：

| 伤害来源 | 基础伤害 | 修正 | 最终伤害 |
|---------|---------|------|---------|
| 直接攻击（未被阻挡） | 1 | Damage 2 → 2, Damage +1 → +1 | N |
| Impact 1 | 1 | Impact +1 → +1 | N |
| 效果伤害 | 效果指定 | — | 效果指定 |

**不负责**：
- 不处理 Trigger 检查（由 TriggerSystem 处理）
- 不处理胜利条件判断（由 GameState / RuleValidator 处理）

---

### 2.13 TriggerSystem（触发检查系统）

**定位**：专门处理生命区卡牌被翻开后的 Trigger 检查与结算。

**职责**：
- 管理 Trigger 检查流程（翻卡 → 检查 → 可选发动 → Sideline）
- 多点伤害时多张 Trigger 的顺序管理
- Trigger 能力的激活与结算协调（委托 AbilitySystem 执行具体效果）
- 无 Trigger 卡牌的 Sideline 处理

**Trigger 检查流程**：

```
For each damage point:
  1. 攻击方从防御方生命区选择1张卡
  2. 翻开该卡（正面朝上）
  3. 检查是否有 Trigger 能力
     - 有 → 防御方选择是否发动
       - 发动 → 结算能力 → 卡进入 Sideline
       - 不发动 → 卡进入 Sideline
     - 无 → 卡进入 Sideline
  4. 多张 Trigger（Damage 2+）：
     - 防御方按任意顺序逐一结算
     - 每张结算完后进入 Sideline，再结算下一张
```

**不负责**：
- 不执行 Trigger 能力的具体效果（委托 AbilitySystem）
- 不判断伤害点数（由 DamageSystem 提供）

---

### 2.14 RaidSystem（Raid管理系统）

**定位**：管理 Raid 机制的验证、执行和堆叠状态追踪。

**职责**：
- 验证 Raid 目标合法性（名称/属性匹配、目标在场）
- 执行 Raid 结算流程（堆叠→状态切换→可选移动→When Played）
- 管理堆叠卡牌状态（顶层卡有效、底层卡能力失效）
- 处理 Raid 卡离开场上的清理（顶层去目标区、底层→Sideline）

**Raid 结算顺序**（来自规则手册）：

```
1. 验证目标角色在场且匹配 targetSpecifier
2. 验证能量需求 + AP
3. 支付 AP → 堆叠在目标上
4. 底层卡能力失效
5. 如果底层卡为 Resting → 切换为 Active
6. 如果在能量线上 → 可选移至前线
7. 触发顶层卡的 When Played 能力
```

**不负责**：
- 不处理 When Played 能力的具体结算（委托 AbilitySystem）

---

### 2.15 StateHistory（状态历史记录）

**定位**：记录所有状态变更，支持回溯、调试和 replay。

**职责**：
- 记录每次状态变更的快照或增量
- 支持按操作步骤回溯（undo）
- 支持完整 replay（用于调试和测试）
- 提供变更日志供 AI / UI 使用

**记录粒度**：
- 每个 Action 处理前后各一个快照（或增量 diff）
- 每个能力结算的阶段记录
- 战斗结算每个子步骤的记录

**不负责**：
- 不参与规则判断（纯记录）

---

### 2.16 DeckBuilder（卡组构筑验证）

**定位**：验证卡组是否符合构筑规则。

**职责**：
- 验证卡组总数 = 50
- 验证所有卡牌来源材料代码一致
- 验证同名卡 ≤ 4张
- 验证 SPECIAL/FINAL Trigger 合计 ≤ 4张
- 验证 AP 卡 = 3张（引擎自动添加）

**不负责**：
- 不管理玩家拥有的卡牌收藏（那是另一层系统）

---

## 3. 游戏状态设计

### 3.1 GameState 顶层结构

```
GameState {
  gameId: string                    // 游戏唯一标识
  phase: GamePhase                  // 当前阶段
  turnNumber: number                // 当前回合数（从1开始）
  currentPlayerId: string           // 当前回合玩家ID
  players: [PlayerState, PlayerState]  // 双方玩家状态
  battleState: BattleState | null   // 当前战斗状态（非Attack Phase时为null）
  abilityQueue: AbilityInstance[]   // 当前待结算的能力队列
  stateVersion: number              // 状态版本号（每次变更递增）
  winner: string | null             // 胜者ID（游戏结束时设置）
}
```

### 3.2 PlayerState

```
PlayerState {
  playerId: string                  // 玩家标识
  playerOrder: 'PlayerOne' | 'PlayerTwo'  // 先手/后手
  
  // 区域
  deck: CardInZone[]                // 卡组（背面，仅自己可查看内容）
  hand: CardInZone[]                // 手牌（仅自己可查看）
  frontLine: CharacterCard[]        // 前线（公开，最多4张）
  energyLine: CardOnField[]         // 能量线（公开，最多4张，角色/Site混合）
  lifeArea: CardInZone[]            // 生命区（背面，初始7张）
  apArea: APCard[]                  // AP区（公开，0-3张）
  sideline: CardInZone[]            // Sideline（公开，无限制）
  removalArea: CardInZone[]         // 移除区（公开，无限制）

  // 资源摘要（缓存值，避免重复计算）
  energyPool: { [color: string]: number }  // 当前可用能量（按颜色）
  availableAP: number               // 当前可用AP数（Active AP卡数量）
}
```

### 3.3 区域内的卡牌表示

```
CardInZone {
  cardId: string                    // 卡牌数据ID（指向 CardRegistry）
  instanceId: string                // 运行时唯一实例ID
  ownerId: string                   // 所属玩家
  faceUp: boolean                   // 朝向（正面/背面）
  position: number                  // 在区域内的位置（0-based）
}

CardOnField extends CardInZone {
  state: 'Active' | 'Resting'       // 场上状态
  currentBP: number                 // 当前BP（含所有修改）
  appliedEffects: EffectInstance[]  // 当前生效的效果列表
  raidedBy: CardOnField | null      // 被哪张Raid卡堆叠（底层卡用）
  raiding: CardOnField | null       // 堆叠在哪张卡上（顶层卡用）
  abilityUsageThisTurn: Set<string> // 本回合已使用的能力ID（Once Per Turn追踪）
  enteredFieldThisTurn: boolean     // 是否本回合入场（用于召唤失调相关判断，需要确认）
}
```

### 3.4 BattleState（战斗状态）

```
BattleState {
  phase: 'ATTACKER_DECLARATION' | 'BLOCKER_DECLARATION' | 'RESOLVING' | 'ENDING'
  attacker: {
    card: CharacterCard             // 攻击角色
    bpAtDeclaration: number         // 宣言时的BP快照
  }
  target: {
    type: 'PLAYER' | 'CHARACTER'
    playerId: string                // 目标玩家
    characterCard?: CharacterCard   // 目标角色（Snipe时）
  }
  blocker: {
    card: CharacterCard | null      // 阻挡角色（未阻挡时为null）
    bpAtDeclaration: number | null  // 宣言时的BP快照
  }
  isSnipe: boolean                  // 是否为Snipe攻击
  battleEffects: EffectInstance[]   // "本次战斗中"持续性效果列表
  damageDealt: number               // 已造成的伤害点数
}
```

### 3.5 TurnInfo（回合信息）

```
TurnInfo {
  turnNumber: number                // 第几回合（1-based）
  currentPlayerId: string           // 当前回合玩家
  phase: GamePhase                  // 当前阶段
  step: number                      // 当前阶段内的步骤序号
  isExtraDrawUsed: boolean          // 本回合是否已使用额外抽牌
  isFirstTurn: boolean              // 是否为先手第1回合（跳过抽牌）
}
```

### 3.6 状态不可变性原则

```
所有状态更新遵循不可变更新模式：

// ❌ 不允许
gameState.players[0].hand.push(card)

// ✅ 允许
const newState = gameState.update(playerId, {
  hand: [...prevHand, card]
})

优点：
  - 状态变更可追溯（每个版本都是完整快照）
  - 便于调试和 replay
  - 避免副作用导致的 bug
  - 支持未来需求：rollback / undo / 观战模式
```

---

## 4. 数据流设计

### 4.1 主数据流（一次完整操作）

```
                           ┌──────────────┐
                           │  Player / AI │
                           │  发起操作请求  │
                           └──────┬───────┘
                                  │ action
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ActionSystem.handleAction(action)         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 1: 基础验证                                          │   │
│  │   - 游戏状态是否允许操作（非结束状态）                       │   │
│  │   - 是否为当前玩家的合法操作                                │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 2: 规则验证 (RuleValidator)                          │   │
│  │   - 阶段权限检查                                          │   │
│  │   - 能量/AP检查                                           │   │
│  │   - 目标合法性检查                                         │   │
│  │   - 状态条件检查                                          │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                     [不合法] → 返回 Error                        │
│                              │                                   │
│                     [合法]    ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 3: 执行操作 (DomainSystem)                           │   │
│  │   - 支付代价 (AP/能量等)                                  │   │
│  │   - 执行卡牌移动/状态变更                                  │   │
│  │   - 计算中间结果                                          │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 4: 应用状态变更 (GameState)                          │   │
│  │   - 产生新 GameState 版本                                 │   │
│  │   - 记录到 StateHistory                                  │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 5: 发布事件 (EventBus)                               │   │
│  │   - 根据变更类型发布对应事件                                │   │
│  │   - 如: CARD_PLAYED, STATE_CHANGED 等                     │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 6: 能力触发器检查 (AbilitySystem)                     │   │
│  │   - 监听 EventBus 事件                                    │   │
│  │   - 匹配注册的能力 timing                                  │   │
│  │   - 检查条件 → 加入 AbilityQueue                          │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 7: 能力队列结算 (AbilitySystem)                       │   │
│  │   - 按规则排序（回合玩家优先）                              │   │
│  │   - 逐一结算：代价支付 → 效果执行 → 状态变更                │   │
│  │   - 新触发的能力加入队列                                   │   │
│  │   - 重复直到队列为空                                       │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 8: 胜利条件检查                                       │   │
│  │   - 生命区为空？→ 对手胜利                                 │   │
│  │   - 牌库为空且需抽牌？→ (在Start Phase检查)                 │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Step 9: 返回操作结果                                       │   │
│  │   - ActionResult { success, newState, events, log }       │   │
│  │   - 可选操作列表（如需要进一步选择）                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 打出一张角色卡的完整数据流（示例）

```
1. Player → ActionSystem: { type: PLAY_CHARACTER, cardId: "HTR-1-001", targetZone: "FRONT_LINE" }

2. RuleValidator 检查：
   ✓ 当前阶段 == MAIN_PHASE？
   ✓ 卡牌在手牌中？
   ✓ 能量满足？→ totalEnergy["白"] >= requiredEnergy.amount？
   ✓ AP 满足？→ availableAP >= apCost？
   ✓ 目标区域容量？→ frontLine.length < 4？(等于4时需先移除)
   ✓ 卡牌类型 == Character？（只能放到前线/能量线）

3. 执行：
   - AP支付：switch apCards[0..apCost] → Resting
   - 卡牌移动：hand → frontLine
   - 设置状态：Resting
   - 记录能力使用追踪

4. GameState 更新 → StateHistory 记录

5. EventBus 发布：
   - CARD_PLAYED { card, targetZone, playerId }
   - STATE_CHANGED { diff }

6. AbilitySystem 检查触发器：
   - 该卡是否有 When Played 能力？→ 加入 AbilityQueue
   - 场上其他卡是否有响应 When Played 的能力？→ 加入 AbilityQueue

7. AbilityQueue 结算：
   - 按顺序结算 When Played 能力
   - 新触发的能力继续加入队列
   - 直到队列为空

8. 胜利条件检查（此时通常无变化）

9. 返回 ActionResult { success: true, ... }

→ 操作完成，状态回到"等待下一个操作"
```

### 4.3 一次攻击的完整数据流（示例）

```
1. Player → ActionSystem: { type: DECLARE_ATTACK, characterId: "inst-005", targetType: "PLAYER" }

2. RuleValidator 检查：
   ✓ 当前阶段 == ATTACK_PHASE？
   ✓ 角色在前线？
   ✓ 角色状态 == Active？
   ✓ 没有阻止攻击的效果？

3. 执行攻击宣言：
   - 角色 Active → Resting
   - 创建 BattleState { phase: ATTACKER_DECLARATION }
   - 记录目标 = 对方玩家

4. EventBus 发布：ATTACK_DECLARED
   → AbilitySystem 检查 When Attacking → 结算

5. BattleState → BLOCKER_DECLARATION
   → 防御方选择是否阻挡

6a. [阻挡] → BLOCK_DECLARED → When Blocking 结算 → BP比较
6b. [不阻挡] → NO_BLOCK → 未被阻挡能力结算 → 直接伤害计算

7. [角色vs角色] BP比较：
   7a. 攻方BP >= 目标BP → 目标Sidelined → Impact → 战斗获胜能力
   7b. 攻方BP < 目标BP → 攻击战败能力 → 防御方战斗获胜能力

8. [角色vs玩家] 直接伤害：
   DamageSystem 计算伤害点数
   → 攻击方选生命卡 → 翻开
   → TriggerSystem 处理 Trigger

9. BATTLE_ENDING → 战斗结束能力 → 清除"本次战斗中"效果

10. Double Attack? → 攻击角色 Resting → Active

11. BattleState → null（攻击阶段仍继续，可继续攻击）

→ 状态回到 Attack Phase，等待选择下一个攻击角色或结束攻击阶段
```

---

## 5. 卡牌扩展设计

### 5.1 核心理念

> **引擎不理解卡牌，引擎只解释数据。**

新增 100 张卡、1000 张卡、或整个新卡包，均不需要修改引擎代码。只需要添加 JSON 数据文件。

### 5.2 卡牌数据管道

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Card Data       │     │ CardSystem        │     │ Runtime         │
│ (JSON Files)    │ ──→ │ (Load + Validate  │ ──→ │ (Ability JSON   │
│                 │     │  + Expand + Reg)  │     │  ready to use)  │
│ per set/booster │     │ at engine startup │     │ in CardRegistry │
└─────────────────┘     └──────────────────┘     └─────────────────┘

  新增卡包流程：
  1. 创建文件夹: data/cards/{SET_CODE}/
  2. 放入 JSON 文件: {SET_CODE}-{rarity}-{number}.json
  3. 重启引擎（或热加载）→ 自动验证 + 注册
  4. 完成
```

### 5.3 卡牌数据目录结构（规划）

```
data/
├── cards/
│   ├── UA03BT/               # 卡包1
│   │   ├── HTR/              # 来源材料: Hunter x Hunter
│   │   │   ├── HTR-1-001.json
│   │   │   ├── HTR-1-002.json
│   │   │   └── ...
│   │   └── BLEACH/           # 来源材料: Bleach（假设）
│   │       └── ...
│   ├── UA04BT/               # 卡包2（未来）
│   │   └── ...
│   └── ...
├── keywords/
│   └── keyword_definitions.json    # 关键词定义库（引擎内置）
├── schemas/
│   └── card_schema.json            # JSON Schema 用于验证
└── abilities/
    └── ability_templates.json      # 可复用的能力模板
```

### 5.4 关键词扩展机制

**内建关键词库**（引擎内置，不在卡牌 JSON 中重复定义）：

```json
{
  "keywords": {
    "Step": {
      "description": "During your movement phase, may move from front line to energy line.",
      "expandsTo": [
        {
          "timing": "MOVEMENT_PHASE",
          "condition": null,
          "costs": [],
          "effects": [{ "effectType": "ALLOW_REVERSE_MOVEMENT" }]
        }
      ]
    },
    "Snipe": { ... },
    "Double Attack": { ... },
    "Double Block": { ... },
    "Impact 1": { ... },
    "Impact +1": { ... },
    "Damage 2": { ... },
    "Damage +1": { ... },
    "Nullify Impact": { ... }
  }
}
```

**未来新关键词扩展**：
1. 在 `keyword_definitions.json` 中添加新关键词定义
2. 在卡牌 JSON 的 `keywords` 字段中引用
3. 引擎加载时自动展开 → 无需修改引擎代码

### 5.5 新效果类型扩展

当未来卡牌需要现有效果系统无法表达的新效果类型时：

1. 在 `effectType` 枚举中注册新类型
2. 在 EffectExecutor 中添加对应的执行函数
3. 在 Card_System.md 中记录新效果类型的参数规范

> **这是唯一需要修改引擎代码的场景**，且仅在出现全新效果类型时才需要。
> 大部分新卡牌的能力是现有效果类型的组合，无需修改引擎。

### 5.6 100张 vs 1000张 vs 10000张卡牌的伸缩性

| 规模 | 挑战 | 设计对策 |
|------|------|---------|
| 100张 | 手动管理可行 | JSON 文件直接管理 |
| 1000张 | 数据验证需求增加 | 严格 JSON Schema + 自动验证 |
| 10000张 | 加载性能、查询效率 | 按卡包懒加载、CardRegistry 使用 HashMap 索引（cardId → Card）、热加载支持 |

**CardRegistry 索引策略**：

```
CardRegistry {
  byId: Map<cardId, Card>           // O(1) 按ID查询
  bySource: Map<sourceCode, Card[]> // 按来源材料查询
  byType: Map<CardType, Card[]>     // 按类型查询
  byAffinity: Map<Affinity, Card[]> // 按属性查询
  bySet: Map<SetCode, Card[]>       // 按卡包查询
  all: Card[]                       // 全量列表
}
```

---

## 6. 效果系统设计

### 6.1 设计原则

1. **组合优于特化** — 复杂效果由简单效果的组合实现
2. **数据定义行为** — 每个效果类型有明确的 JSON Schema
3. **可扩展但不需频繁扩展** — 6大效果类型覆盖绝大多数场景
4. **效果与时机解耦** — 同一个效果可以在不同 timing 触发

### 6.2 效果类型体系

基于 Card_System.md §4.6 的设计，将效果分为 **6大类 + 1特殊类**：

#### 类1：卡牌移动 (Card Movement)

| 效果类型 | 参数 | 描述 |
|---------|------|------|
| `DRAW_CARD` | count, player | 玩家抽N张卡 |
| `MOVE_TO_ZONE` | target, destination | 将卡牌移动到指定区域 |
| `SIDELINE` | target | 将卡牌Sidelined（触发When Sidelined） |
| `PLACE_INTO_SIDELINE` | target | 将卡牌放入Sideline（不触发When Sidelined） |
| `RETURN_TO_HAND` | target | 返回手牌 |
| `PLACE_INTO_REMOVAL` | target | 放入移除区 |
| `SWAP_POSITIONS` | targetA, targetB | 交换两张卡的位置 |

#### 类2：BP修改 (BP Modification)

| 效果类型 | 参数 | 描述 |
|---------|------|------|
| `BP_BUFF` | target, amount, duration | BP增加 |
| `BP_DEBUFF` | target, amount, duration | BP减少 |
| `BP_SET` | target, amount, duration | BP设为固定值 |

#### 类3：状态修改 (State Modification)

| 效果类型 | 参数 | 描述 |
|---------|------|------|
| `SWITCH_TO_ACTIVE` | target | 切换为Active |
| `SWITCH_TO_RESTING` | target | 切换为Resting |
| `PREVENT_ACTIVE_SWITCH` | target, duration | 阻止切换Active |
| `PREVENT_RESTING_SWITCH` | target, duration | 阻止切换Resting |
| `PREVENT_ATTACK` | target, duration | 阻止攻击 |
| `PREVENT_BLOCK` | target, duration | 阻止阻挡 |

#### 类4：关键词授予 (Keyword Grant)

| 效果类型 | 参数 | 描述 |
|---------|------|------|
| `GAIN_KEYWORD` | target, keyword, duration | 获得关键词 |
| `LOSE_KEYWORD` | target, keyword, duration | 失去关键词 |
| `NULLIFY_KEYWORD` | target, keyword, duration | 无效化关键词（如 Nullify Impact） |

#### 类5：伤害与恢复 (Damage & Recovery)

| 效果类型 | 参数 | 描述 |
|---------|------|------|
| `DEAL_DAMAGE` | source, targetPlayer, amount | 造成伤害 |
| `MODIFY_DAMAGE` | amount, modifier | 修改伤害值 |
| `SET_DAMAGE_MULTIPLIER` | multiplier | 设置伤害倍率（Damage 2） |

#### 类6：信息操作 (Information)

| 效果类型 | 参数 | 描述 |
|---------|------|------|
| `SEARCH_DECK` | filter, count, destination, reveal | 搜索卡组 |
| `REVEAL_CARD` | target | 展示卡牌 |
| `LOOK_AT_ZONE` | zone, player | 查看区域 |
| `MILL_DECK` | count, player | 牌库顶弃牌 |

#### 特殊类：复合效果 (Compound)

| 效果类型 | 参数 | 描述 |
|---------|------|------|
| `SEQUENCE` | effects[] | 顺序执行多个效果 |
| `CHOICE` | options[] | 从多个效果中选择一个 |
| `CONDITIONAL_EFFECT` | condition, ifTrue, ifFalse | 条件分支效果 |
| `SUBSTITUTE` | condition, originalText, substituteText | `{x} instead` 替代效果 |

### 6.3 目标选择系统

```
TargetDescriptor {
  targetType: 'CHARACTER' | 'SITE' | 'CARD' | 'PLAYER' | 'SELF'
  scope: 'SELF' | 'OPPONENT' | 'ANY' | 'ALL'
  location: 'FRONT_LINE' | 'ENERGY_LINE' | 'FIELD' | 'HAND' | 'LIFE' | 'SIDELINE' | 'DECK' | 'ANYWHERE'
  
  // 可选筛选条件
  filter?: {
    cardType?: CardType
    color?: Color
    affinity?: string
    bpMin?: number
    bpMax?: number
    state?: 'ACTIVE' | 'RESTING' | 'ANY'
    hasKeyword?: string
    hasTrigger?: boolean
    isRaid?: boolean
    customCondition?: string     // 备用：引用自定义条件函数名（尽量避免使用）
  }
  
  count: number | 'upTo:'+number | 'all'
  chooser: 'CONTROLLER' | 'OPPONENT' | 'OWNER'
}
```

### 6.4 条件系统 (Condition)

基于 Card_System.md §4.4，条件分为以下几类：

```
位置条件：
  IF_ON_FRONT_LINE        卡在前线
  IF_ON_ENERGY_LINE       卡在能量线
  IF_ON_FIELD             卡在场（前线或能量线）

状态条件：
  IF_ACTIVE               卡为Active状态
  IF_RESTING              卡为Resting状态

场面条件：
  IF_OPPONENT_HAS_CHARACTER   对方前线有角色
  IF_AFFINITY_COUNT_N         场上某属性数量≥N
  IF_ENERGY_COUNT_N           能量线上卡牌数量≥N

手牌条件：
  IF_HAND_NOT_EMPTY       手牌不为空
  IF_HAND_COUNT_N         手牌数量≥N

生命条件：
  IF_LIFE_UNDER_N         生命值≤N
  IF_LIFE_ABOVE_N         生命值≥N

战斗条件：
  IF_NOT_BLOCKED          未被阻挡
  IF_IS_FIRST_ATTACK      本回合首次攻击
  IF_IS_FIRST_BLOCK       本回合首次阻挡

复合条件：
  AND                    所有子条件为真
  OR                     任一子条件为真
  NOT                    取反
```

### 6.5 代价系统 (Cost)

基于 Card_System.md §4.5：

```
代价类型：
  SWITCH_TO_RESTING           自身 Active → Resting
  PAY_AP(n)                   支付n点AP
  SIDELINE_THIS_CARD          自身进入Sideline
  DISCARD_FROM_HAND(n)        弃n张手牌（放入Sideline）
  SIDELINE_FROM_HAND(n)       从手牌Sideline n张
  PLACE_FROM_HAND_TO_REMOVAL(n) 从手牌放n张到移除区

代价支付规则：
  - 所有代价必须能完整支付
  - 支付是原子性的（全付或全不付）
  - 先支付代价 → 后结算效果
```

### 6.6 持续时间 (Duration)

基于 Card_System.md §4.8：

```
Duration 层级（从短到长）：

  INSTANT                      立即生效，无持续
  DURING_BATTLE                本次战斗结束时清除
  UNTIL_END_OF_ATTACK_PHASE    本次攻击阶段结束时清除
  UNTIL_END_OF_TURN            本回合结束时清除
  UNTIL_START_OF_NEXT_TURN     下回合开始时清除
  UNTIL_END_OF_NEXT_ATTACK_PHASE 下次攻击阶段结束时清除
  WHILE_ON_FIELD               卡在场期间持续
  PERMANENT                    永久（除非被清除）
```

### 6.7 效果执行器调度

```
EffectExecutor 根据 effectType 分发到对应处理器：

┌─────────────────────┐
│  EffectExecutor     │
│  (Dispatcher)       │
└─────────┬───────────┘
          │
    ┌─────┼─────┬─────────┬──────────┬──────────┐
    ▼     ▼     ▼         ▼          ▼          ▼
┌──────┐┌────┐┌──────┐┌──────┐┌──────────┐┌──────────┐
│Move  ││BP  ││State ││Keyword││Damage    ││Info      │
│Exec  ││Exec││Exec  ││Exec   ││Exec      ││Exec      │
└──────┘└────┘└──────┘└──────┘└──────────┘└──────────┘

每个 Executor 返回:
  {
    stateChanges: StateChange[]     // 需要应用的 GameState 变更
    events: GameEvent[]             // 产生的事件
    subEffects: Effect[]            // 连锁产生的子效果（如有）
  }
```

### 6.8 效果结算顺序（单个能力内多个效果）

```
当一个能力包含多个效果时：
  - 按效果在 effects[] 数组中的顺序依次结算
  - 每个效果完全结算后（包括其产生的事件和触发的能力），再结算下一个效果
  
规则依据：官方规则手册 — 同时发动规则中"结算过程中产生的新能力加入未结算队列"
```

---

## 7. 后续开发路线

### 7.1 阶段 2 开发优先级排序

基于架构设计，将阶段 2 的 6 个子阶段重新排序，以模块依赖关系为导向：

```
依赖关系图：

  CardSystem ─────────────────────────────┐
  (无依赖，可最先开发)                      │
                                          │
  GameState ──────────────────────────────┤
  (需要数据模型，依赖 CardSystem 定义)      │
                                          │
  EventBus ───────────────────────────────┤
  (无依赖)                                │
                                          ▼
  TurnManager ──────┐             AbilitySystem
  (依赖 GameState)   │             (依赖 EventBus +
                     │              GameState +
                     │              CardSystem)
                     │                    │
                     ▼                    │
  EnergySystem ──────┤                    │
  (依赖 GameState +   │                    │
   CardSystem)       │                    │
                     │                    │
  MovementSystem ────┤                    │
  (依赖 GameState)    │                    │
                     │                    │
  BattleSystem ──────┤                    │
  (依赖 GameState +   │                    │
   EventBus +         │                    │
   AbilitySystem)     │                    │
                      │                    │
  DamageSystem ───────┤                    │
  (依赖 GameState +    │                    │
   BattleSystem)      │                    │
                      │                    │
  TriggerSystem ──────┤                    │
  (依赖 GameState +    │                    │
   AbilitySystem +     │                    │
   DamageSystem)       │                    │
                      │                    │
  RaidSystem ─────────┘                    │
  (依赖 CardSystem +                        │
   EnergySystem +                          │
   AbilitySystem)                          │
                                           │
  RuleValidator ───────────────────────────┘
  (依赖所有系统)

  ActionSystem
  (依赖 RuleValidator + 所有领域系统)

  StateHistory
  (依赖 GameState)

  GameEngine (Facade)
  (依赖所有上述模块)
```

### 7.2 推荐开发批次

#### Batch 0：基础设施（必须最先）

| 序号 | 任务 | 产出 | 预计复杂度 |
|------|------|------|-----------|
| 0.1 | 项目骨架搭建 | Node.js/TypeScript 项目 + 测试框架 | 低 |
| 0.2 | 卡牌 JSON Schema 定义 | `card_schema.json` | 中 |
| 0.3 | 首批测试卡牌数据 | 20张测试卡（覆盖4种类型 + 全关键词） | 中 |
| 0.4 | EventBus 基础实现 | 事件发布/订阅 | 低 |
| 0.5 | 基础类型定义 | CardType, Phase, Zone, Color 等枚举 | 低 |

#### Batch 1：核心数据与状态（Batch 0 之后）

| 序号 | 任务 | 产出 | 预计复杂度 |
|------|------|------|-----------|
| 1.1 | CardSystem（加载+验证+关键词展开） | CardRegistry | 中 |
| 1.2 | GameState 核心模型 | GameState + PlayerState + Zone 管理 | 中 |
| 1.3 | StateHistory | 状态变更记录 | 低 |

#### Batch 2：流程控制（Batch 1 之后）

| 序号 | 任务 | 产出 | 预计复杂度 |
|------|------|------|-----------|
| 2.1 | TurnManager（5阶段状态机） | TurnManager | 中 |
| 2.2 | EnergySystem | EnergyCalculator | 低 |
| 2.3 | MovementSystem | MovementManager | 低 |
| 2.4 | RuleValidator（基础） | Phase/Energy/AP 验证 | 中 |

#### Batch 3：能力与战斗（Batch 2 之后，核心难点）

| 序号 | 任务 | 产出 | 预计复杂度 |
|------|------|------|-----------|
| 3.1 | AbilitySystem — 数据结构 + 注册 | AbilityRegistry | 高 |
| 3.2 | AbilitySystem — 条件评估器 | ConditionEvaluator | 高 |
| 3.3 | AbilitySystem — 代价支付器 | CostPayer | 中 |
| 3.4 | AbilitySystem — 效果执行器 | EffectExecutor (6大类) | 高 |
| 3.5 | AbilitySystem — 队列管理 | AbilityQueue | 高 |
| 3.6 | AbilitySystem — Duration管理 | DurationManager | 中 |
| 3.7 | DamageSystem | DamageCalculator | 中 |
| 3.8 | TriggerSystem | TriggerResolver | 中 |
| 3.9 | BattleSystem（完整） | BattleResolver | 高 |

#### Batch 4：高级特性（Batch 3 之后）

| 序号 | 任务 | 产出 | 预计复杂度 |
|------|------|------|-----------|
| 4.1 | RaidSystem | RaidManager | 中 |
| 4.2 | RuleValidator（完整 — 所有规则） | 完整验证器 | 中 |
| 4.3 | 卡组构筑验证 | DeckBuilder | 低 |
| 4.4 | Once Per Turn 追踪 | 集成到 AbilitySystem | 低 |
| 4.5 | 持续性效果管理完善 | DurationManager 增强 | 中 |

#### Batch 5：集成与 GameEngine

| 序号 | 任务 | 产出 | 预计复杂度 |
|------|------|------|-----------|
| 5.1 | ActionSystem 集成 | ActionSystem | 中 |
| 5.2 | GameEngine 集成 | GameEngine Facade | 中 |
| 5.3 | 端到端集成测试 | 完整游戏流程测试 | 中 |
| 5.4 | 边界情况测试 | 100+ 测试用例 | 高 |

### 7.3 里程碑定义

| 里程碑 | 完成标志 | 包含 Batch |
|--------|---------|-----------|
| **M1: 数据就绪** | 卡牌可加载、可查询、可验证 | Batch 0 + 1 |
| **M2: 回合可运转** | 完整的 5 阶段空转（不出牌） | M1 + Batch 2 |
| **M3: 可打牌** | 打出角色/Site/Event，能量+AP检查 | M2 + ActionSystem基础 |
| **M4: 能力可结算** | When Played / Activate: Main 能力正确结算 | M3 + Batch 3 (3.1-3.6) |
| **M5: 可战斗** | 完整的攻击→阻挡→结算→伤害→Trigger流程 | M4 + Batch 3 (3.7-3.9) |
| **M6: 完整规则** | Raid + 所有边界情况 + 完整测试 | M5 + Batch 4 + 5 |

---

## 8. 架构评估

### 8.1 针对长期运营 TCG 的适配性

| 需求 | 架构对策 | 评估 |
|------|---------|------|
| 持续新增卡包 | 数据驱动：新增 JSON 文件即可，无需改引擎 | ✅ 充分支持 |
| 新关键词 | 关键词定义库独立：新增定义→自动展开 | ✅ 充分支持 |
| 新效果类型 | 需在 EffectExecutor 注册新类型（低频率） | ⚠️ 需小量引擎改动 |
| 规则变更/勘误 | RuleValidator 集中管理：修改点明确 | ✅ 充分支持 |
| AI 对战 | GameEngine 统一 API：AI 所见即玩家所见 | ✅ 充分支持 |
| 网络对战 | 状态同步可基于 StateHistory 的增量 diff | ✅ 支持（阶段3） |
| 观战/Replay | StateHistory 提供完整记录 | ✅ 充分支持 |
| 服务器端验证 | RuleValidator 独立：Server 端复用验证逻辑 | ✅ 充分支持 |

### 8.2 架构优势

1. **高内聚低耦合** — 每个子系统职责明确，通过 EventBus 松耦合通信
2. **可测试性强** — 每个模块可独立单元测试；GameState 不可变性确保测试可重现
3. **渐进式开发** — Batch 依赖链清晰，可以逐步构建并验证
4. **数据驱动** — 卡牌数据与逻辑分离，新增内容不需要代码变更
5. **规则集中化** — RuleValidator 将所有规则判断集中，避免规则散落 bug

### 8.3 已知风险与缓解

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| AbilitySystem 过于复杂 | 开发周期长、bug 多 | 6大类效果独立开发测试，效果组合通过集成测试覆盖 |
| 同时发动队列实现难度 | 规则歧义 | 严格按规则手册实现，编写详细单元测试 |
| 性能（10000张卡加载） | 启动慢 | 懒加载 + 索引优化；可预计算展开后的能力数据 |
| 新卡包引入全新机制 | 架构假设被打破 | 架构审查机制：每个新卡包发布前审查是否需要架构扩展 |
| 状态快照内存占用 | 长时间对局内存大 | 使用增量 diff 代替全量快照（可选优化） |

### 8.4 规则疑点确认状态

9 条规则疑点已于 2026-08-03 完成裁决，详见 `Rule_Resolution.md`。

**确认结果概要**：

| # | 编号 | 问题简述 | 裁决 | 影响 |
|---|------|---------|------|------|
| 1 | RQ-001 | When Played 触发范围 | ✅ C — 任意方式进场上即触发 | AbilitySystem：CARD_PLAYED 事件范围扩大到所有入场方式 |
| 2 | RQ-002 | 入场角色攻击限制 | ✅ Other — Active/Resting 状态决定，无额外规则 | BattleSystem：无需追踪入场回合，只检查 Active 状态 |
| 3 | RQ-003 | Start Phase 效果清除顺序 | ✅ A — 同时清除 | DurationManager：batch clear，无排序逻辑 |
| 4 | RQ-004 | Raid 描述能力失效范围 | ✅ A — 框内全部内容仅 Raid 时生效 | CardSystem：raidAbilities 与 abilities 分离存储 |
| 5 | RQ-005 | Energy Line + 标记行为 | ✅ B — 自身能力可能改变能量生成 | EnergySystem：hasPlus → 检查该卡 abilities |
| 6 | RQ-006 | 手牌上限弃牌选择权 | ✅ A — 手牌持有者本人选择 | TurnManager：确认现有设计 |
| 7 | RQ-007 | Trigger 不算使用卡牌 | ✅ A — Trigger 是独立机制 | RuleValidator：Attack Phase 明确允许 Trigger |
| 8 | RQ-008 | 先手第一回合限制 | ✅ B — 不能进入 Attack Phase | TurnManager：Player One Turn 1 跳过 Attack Phase |
| 9 | RQ-009 | 新触发能力队列插入位置 | ⏳ D — 待查官方 FAQ | AbilityQueue：实现需保留灵活性 |

> **已确认的 8 条已纳入各设计文档。RQ-009 仍待后续查证，AbilityQueue 实现时需预留两种可能路径。**

### 8.5 结论

本架构设计满足 Union Arena 数字版长期运营的需求：

- **模块划分清晰**：16 个模块各司其职，通过 EventBus 松耦合
- **数据驱动**：卡牌数据与游戏逻辑完全分离
- **可扩展**：新增卡牌/关键词/效果类型均有明确的扩展路径
- **可测试**：每个模块可独立测试，不可变状态保证可重现性
- **渐进式**：7 个里程碑提供清晰的开发节奏

> **下一步**：进入 Batch 0 — 项目骨架搭建与卡牌 JSON Schema 定义。

---

## 附录 A：模块间依赖矩阵

| 模块 | 依赖 |
|------|------|
| GameEngine | ActionSystem, TurnManager, GameState, EventBus |
| GameState | 基础类型定义 |
| TurnManager | GameState, EventBus |
| ActionSystem | RuleValidator, GameState, EventBus, 所有 DomainSystems |
| RuleValidator | GameState, CardSystem, EnergySystem（查询，不修改） |
| EventBus | 无依赖 |
| CardSystem | 基础类型定义 |
| EnergySystem | GameState（只读） |
| AbilitySystem | EventBus, GameState, CardSystem |
| BattleSystem | GameState, EventBus, AbilitySystem, DamageSystem, TriggerSystem |
| MovementSystem | GameState, EventBus |
| DamageSystem | GameState, EventBus |
| TriggerSystem | GameState, EventBus, AbilitySystem |
| RaidSystem | GameState, CardSystem, EnergySystem, AbilitySystem, EventBus |
| StateHistory | GameState（监听变更） |
| DeckBuilder | CardSystem |

## 附录 B：事件 → 能力 Timing 映射表

| EventBus 事件 | 对应的能力 Timing |
|---------------|------------------|
| `CARD_PLAYED` | `WHEN_PLAYED` |
| `CARD_SIDELINED` / `CHARACTER_SIDELINED_BY_BATTLE` | `WHEN_SIDELINED` |
| `ATTACK_DECLARED` | `WHEN_ATTACKING` |
| `BLOCK_DECLARED` | `WHEN_BLOCKING` |
| `BATTLE_WON` (攻方视角) | `WHEN_BATTLE_WINS` / Impact |
| `BATTLE_LOST` (攻方视角) | `WHEN_BATTLE_LOSES` |
| `BATTLE_NOT_BLOCKED` | `WHEN_NOT_BLOCKED`（需要确认此事件是否存在还是从攻击流程直接判断） |
| `PHASE_CHANGED` → Attack | `START_OF_ATTACK_PHASE` |
| `TURN_STARTED` | `START_OF_TURN` |
| `TURN_ENDED` | `END_OF_TURN` |
| `BATTLE_ENDED` | `END_OF_BATTLE` / Double Attack / Double Block |
| `PHASE_CHANGED` (持续) | `DURING_YOUR_TURN` / `DURING_OPPONENT_TURN` |
| `LIFE_CARD_REVEALED` | `TRIGGER` |

---

> **关联文档**：
> - `Game_Design.md` — 游戏流程与回合结构
> - `Battle_System.md` — 战斗系统详细设计
> - `Card_System.md` — 卡牌系统与效果系统设计
> - `rules_EnglishVer.md` — 官方规则手册
> - `CLAUDE.md` — 项目开发原则
