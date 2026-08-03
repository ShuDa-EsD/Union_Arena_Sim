# Union Arena Digital — Project Status (Phase 2 Entry)

> 快照日期：2026-08-04
> 版本：v0.1.0 (MVP Core Complete)
> 用途：Phase 2（Card Editor + Web Client）开发的唯一上下文入口
>
> 本文档基于**当前代码实际状态**生成。不依赖旧计划文档。

---

## 一、当前版本

| 项目 | 值 |
|------|-----|
| 项目名 | `union-arena-sim` |
| 版本号 | `0.1.0` |
| 运行环境 | Node.js v24 + TypeScript 5.3 |
| 测试框架 | Jest 29 + ts-jest |
| 测试套件 | 17 suites |
| 测试用例 | 181 tests |
| Git 状态 | 未初始化 (无 `.git` 目录) |

---

## 二、已完成内容（Batch 0-6）

### 2.1 核心引擎模块（6 个）

| 模块 | 文件 | 职责 |
|------|------|------|
| **types.ts** | `src/core/types.ts` | 全部类型定义：CardData / GameState / BattleState / StateChange / ActionRequest / ... |
| **EventBus** | `src/core/EventBus.ts` | 同步事件发布/订阅 (`on` / `emit` / `clear`) |
| **GameState** | `src/core/GameState.ts` | 不可变状态工厂 + `applyChanges(changes: StateChange[])` + 只读查询 |
| **TurnManager** | `src/core/TurnManager.ts` | 5 阶段 FSM（Start→Movement→Main→Attack→End）+ RQ-008 先手限制 |
| **RuleValidator** | `src/core/RuleValidator.ts` | 阶段权限矩阵 + 能量/AP/区域验证 |
| **ActionSystem** | `src/core/ActionSystem.ts` | 操作管道：PlayCharacter / PlaySite / UseEvent / PerformRaid / ActivateAbility / ExtraDraw |
| **GameEngine** | `src/core/GameEngine.ts` | 门面类：`newGame()` / `advancePhase()` / `submitAction()` / `declareAttack()` / `declareBlock()` / `skipBlock()` |

### 2.2 领域系统模块（8 个）

| 模块 | 文件 | 职责 |
|------|------|------|
| **CardSystem** | `src/systems/CardSystem.ts` | JSON 加载 + 验证 + 关键词展开 + CardRegistry 构建 |
| **EnergySystem** | `src/systems/EnergySystem.ts` | 能量池汇总（按颜色）+ `canAfford()` |
| **MovementSystem** | `src/systems/MovementSystem.ts` | 正向移动验证 + 容量超限处理 |
| **AbilitySystem** | `src/systems/AbilitySystem.ts` | 5 子组件：TriggerDetector / ConditionEvaluator / CostPayer / EffectExecutor / AbilityQueue |
| **BattleSystem** | `src/systems/BattleSystem.ts` | 攻击→阻挡→BP 比较→伤害→Trigger→Double Attack（含 IsFirstAttackThisTurn 追踪） |
| **DamageSystem** | `src/systems/DamageSystem.ts` | 伤害计算（base/Damage2/Damage+1）+ 生命卡选择 |
| **TriggerSystem** | `src/systems/TriggerSystem.ts` | Trigger 检查 + MVP 自动发动 + 多 Trigger 顺序 |
| **RaidSystem** | `src/systems/RaidSystem.ts` | Raid 验证（Name/Affinity）+ 堆叠 + RQ-004 能力分离 + 离场处理 |

### 2.3 卡牌数据（20 张）

| cardId | 类型 | BP | 能量 | 关键特性 |
|--------|------|-----|------|---------|
| HTR-1-001 | Character | 3000 | 白×1 | 香草 |
| HTR-1-002 | Character | 4000 | 白×1 | 香草 |
| HTR-1-003 | Character | 2000 | 白×2 | 香草（高费） |
| HTR-1-004 | Character | 5000 | 白×2 | 香草（高BP） |
| HTR-1-005 | Site | — | 白×1 | 基础能量来源 |
| HTR-1-006 | Event | — | 白×1 | WhenPlayed: Draw 1 |
| HTR-1-007 | Character | 3000 | 白×1 | WhenPlayed: Draw 1 |
| HTR-1-008 | Character | 3500 | 白×2 | WhenPlayed: Draw 1（高费） |
| HTR-1-009 | Character | 2500 | 白×1 | ActivateMain: ↻+Pay1AP→Draw1 |
| HTR-1-010 | Character | 3000 | 红×2 | WhenPlayed: BP+1000 |
| HTR-1-011 | Event | — | 白×2 | Sideline 对方前线角色 |
| HTR-1-012 | Site | — | 白×1 | WhenPlayed: Draw 1 |
| HTR-1-013 | Character | 3000 | 白×1 | keywords:[Snipe] + Trigger:Draw1 |
| HTR-1-014 | Character | 4000 | 白×1 | keywords:[Impact 1] |
| HTR-1-015 | Character | 3500 | 白×1 | keywords:[Damage 2] |
| HTR-1-016 | Character | 3000 | 白×2 | WhenAttacking: BP+2000 |
| HTR-1-017 | Character | 4000 | 红×1 | Raid(target:HTR-1-001) |
| HTR-1-018 | Character | 4500 | 红×1 | Raid(target:HTR-1-002) + WhenPlayed:BP+1000 |
| HTR-1-019 | Character | 3000 | 白×1 | keywords:[Double Attack] |
| HTR-1-020 | Character | 3000 | 白×2 | keywords:[Step, Nullify Impact] |

### 2.4 关键词（9 种，B5 实现）

| 关键词 | 分类 | 展开效果 | 集成状态 |
|--------|------|---------|---------|
| Snipe | Ability | AllowTargetCharacter + PreventBlock | ✅ |
| Impact 1 | Ability | WhenBattleWins: DealDamage(1) | ✅ |
| Impact +1 | Ability | WhenBattleWins: DealDamage(1, bonus) | ⚠️ 语义待确认 |
| Damage 2 | Battle Modifier | SetDamageMultiplier(2) | ✅ |
| Damage +1 | Battle Modifier | ModifyDamage(+1) | ✅ |
| Double Attack | Battle Modifier | EndOfBattle: DoubleAttack (with IsFirstAttackThisTurn) | ✅ |
| Double Block | Battle Modifier | EndOfBattle: DoubleAttack (with IsFirstBlockThisTurn) | ⚠️ 条件未实现 |
| Step | Rule Modifier | AllowReverseMovement | ⚠️ MovementSystem 未集成 |
| Nullify Impact | Battle Modifier | NullifyKeyword(Impact) | ⚠️ BattleSystem 未集成 |

---

## 三、当前代码结构

```
union-arena-sim/
├── package.json                # v0.1.0, scripts: build/test/scenario
├── tsconfig.json               # strict, ES2020, CommonJS
├── jest.config.js              # ts-jest
├── README.md                   # MVP 使用说明
│
├── src/
│   ├── index.ts                # 入口：npm run scenario <name>
│   │
│   ├── core/                   # 核心引擎（7 文件）
│   │   ├── types.ts            # 全部类型定义
│   │   ├── GameEngine.ts       # 门面类
│   │   ├── GameState.ts        # 不可变状态 + applyChanges
│   │   ├── EventBus.ts         # 同步事件总线
│   │   ├── TurnManager.ts      # 5 阶段 FSM
│   │   ├── RuleValidator.ts    # 规则验证
│   │   └── ActionSystem.ts     # 操作管道
│   │
│   ├── systems/                # 领域系统（8 文件）
│   │   ├── CardSystem.ts       # 加载 + 验证 + 关键词展开
│   │   ├── EnergySystem.ts     # 能量计算
│   │   ├── MovementSystem.ts   # 移动管理
│   │   ├── AbilitySystem.ts    # 能力结算引擎
│   │   ├── BattleSystem.ts     # 战斗流程
│   │   ├── DamageSystem.ts     # 伤害计算
│   │   ├── TriggerSystem.ts    # Trigger 处理
│   │   └── RaidSystem.ts       # Raid 堆叠
│   │
│   ├── data/                   # 卡牌数据
│   │   ├── cards/test_set/     # 20 张测试卡（HTR-1-001 ~ HTR-1-020）
│   │   └── keywords/
│   │       └── keyword_definitions.json  # 9 种关键词定义
│   │
│   ├── scenarios/              # 游戏场景
│   │   └── scenario_basic_game.ts  # 完整对局演示（出牌→攻击→伤害→Trigger→胜负）
│   │
│   └── utils/
│       ├── shuffle.ts          # Fisher-Yates 洗牌
│       └── idgen.ts            # 实例 ID 生成
│
├── tests/                      # 测试（17 文件）
│   ├── core/                   # 核心模块测试（5 文件）
│   │   ├── EventBus.test.ts
│   │   ├── GameState.test.ts
│   │   ├── TurnManager.test.ts
│   │   ├── RuleValidator.test.ts
│   │   └── ActionSystem.test.ts
│   ├── systems/                # 领域系统测试（8 文件）
│   │   ├── CardSystem.test.ts
│   │   ├── EnergySystem.test.ts
│   │   ├── MovementSystem.test.ts
│   │   ├── AbilitySystem.test.ts
│   │   ├── BattleSystem.test.ts
│   │   ├── DamageSystem.test.ts
│   │   ├── TriggerSystem.test.ts
│   │   └── RaidSystem.test.ts
│   ├── integration/            # 集成测试（2 文件）
│   │   ├── full_turn.test.ts
│   │   └── full_game.test.ts
│   ├── fixtures/               # 测试工厂（2 文件）
│   │   ├── test_cards.ts
│   │   └── test_state.ts
│   └── utils/
│       ├── shuffle.test.ts
│       └── idgen.test.ts
│
└── Documents/                  # 设计文档（11 份）
    ├── PROJECT_STATUS_PHASE2.md    ← 本文件
    ├── Architecture.md
    ├── ARCHITECTURE_DECISIONS.md
    ├── MVP_IMPLEMENTATION_PLAN.md
    ├── DEVELOPMENT_BATCH_PLAN.md
    ├── MVP_ARCHITECTURE_REVIEW.md
    ├── TYPE_REVIEW.md
    ├── BATCH_7_CARD_EDITOR_DESIGN.md
    ├── Project_Roadmap.md
    ├── Rule_Resolution.md
    ├── Rule_Impact_Report.md
    └── design/
        ├── Game_Design.md
        ├── Battle_System.md
        └── Card_System.md
```

---

## 四、测试状态

```
Test Suites: 17 passed
Tests:       181 passed
TypeScript:  0 errors
```

### 4.1 按模块分布

| 测试文件 | 用例数 | 覆盖范围 |
|---------|--------|---------|
| EventBus.test.ts | 8 | on/emit/clear/同步/多handler |
| GameState.test.ts | 20 | create/applyChanges/不可变/AP表/区域查询 |
| TurnManager.test.ts | 22 | 5阶段/RQ-008/抽牌/AP调整/事件发射 |
| RuleValidator.test.ts | 17 | 阶段权限/AP检查/区域容量 |
| ActionSystem.test.ts | 9 | PlayChar/Site/Event/Activate/ExtraDraw |
| CardSystem.test.ts | 25 | 加载20卡/验证/关键词展开/等价性 |
| EnergySystem.test.ts | 11 | 能量汇总/canAfford/颜色匹配 |
| MovementSystem.test.ts | 6 | canMove/moveCharacter/容量超限 |
| AbilitySystem.test.ts | 18 | 条件/Cost/Effect/Trigger检测/Queue |
| BattleSystem.test.ts | 8 | declare/Battle/block/BP比较/伤害 |
| DamageSystem.test.ts | 8 | calculateDamage/Damage2/Damage+1 |
| TriggerSystem.test.ts | 4 | hasTrigger/processTriggers |
| RaidSystem.test.ts | 7 | 验证/Name/Affinity/performRaid |
| full_turn.test.ts | 8 | 完整回合/多轮循环 |
| full_game.test.ts | 3 | E2E加载/关键词/胜利条件 |
| shuffle/idgen | 7 | 工具函数 |

---

## 五、可运行命令

```bash
npm install              # 安装依赖（TypeScript + Jest）
npm test                 # 运行全部 181 个测试
npm run build            # 编译 TypeScript → dist/
npm run scenario basic_game  # 运行完整对局演示
npm run test:coverage    # 测试覆盖率报告
```

### 5.1 场景输出示例

```
═══════════════════════════════════════════
  Union Arena MVP — Basic Game Scenario
═══════════════════════════════════════════

  P1 plays HTR-1-007 (WhenPlayed: Draw 1) → ✅ Ability triggered
  P1 plays HTR-1-014 ([Impact 1])
  P1 Attack → P2 Block → BP 3000 vs 4000 → attacker loses
  P2 Attack → P1 Block → BP 4000 vs 3000 → attacker wins
  ...battles continue...
  ⚡ TRIGGER ACTIVATED! HTR-1-013
  ...
  🏁 Winner: p2  |  P1 Life: 0/7  P2 Life: 7/7
═══════════════════════════════════════════
```

---

## 六、架构关键决策（从 ARCHITECTURE_DECISIONS.md 摘要）

| ID | 决策 | 日期 |
|----|------|------|
| AD-001 | TurnManager 使用 FSM 管理 5 阶段 | B2 |
| AD-002 | Game-level 状态变化直接创建新 GameState | B2 |
| AD-003 | Player-scoped 状态变化通过 StateChange + applyChanges | B1-2 |
| AD-004 | RuleValidator 作为统一规则验证入口 | B2 |
| AD-005 | EnergySystem 只负责计算，不负责消耗 | B2 |
| AD-006 | 关键词展开延迟到 B5 | B1 |
| AD-007 | 运行时实例(CardInZone)与静态数据(CardData)分离 | B1 |
| AD-008 | ActionSystem 是玩家操作的唯一入口 | B3 |
| AD-009 | AbilitySystem 职责边界（检测/条件/代价/效果/队列） | B3 |
| AD-010 | AbilityQueue MVP 简化版（B4 扩展） | B3 |
| AD-011 | BattleSystem 只负责战斗流程控制 | B4 |
| AD-012 | DamageSystem 只负责伤害计算 | B4 |
| AD-013 | TriggerSystem 只负责 Trigger 检测与流程 | B4 |
| AD-014 | AbilitySystem 负责 Trigger 能力效果结算 | B4 |
| AD-015 | Trigger MVP 阶段自动发动 | B4 |
| AD-016 | DamageModifier 优先级待规则确认 | B4 |

---

## 七、已知限制

### 7.1 待规则确认

| ID | 问题 | 当前行为 | 风险 |
|----|------|---------|------|
| RQ-009 | 新触发能力队列插入位置 | 归属优先级（选项B） | 可能与官方 FAQ 不一致 |
| DM-001 | Damage 2 + Damage +1 叠加 | multiplier + bonus | 待确认是否叠加 |
| BT-001 | BP 比较用宣言快照 or 实值 | 使用 currentBP（实值） | WhenAttacking BP Buff 可能影响比较 |

### 7.2 功能未完整

| ID | 功能 | 当前状态 |
|----|------|---------|
| MV-001 | Step 逆向移动 | MovementSystem 未集成 AllowReverseMovement |
| BT-002 | Double Block 条件 | IsFirstBlockThisTurn 未实现 |
| TR-001 | Trigger 玩家选择 | MVP 自动发动，不询问玩家 |
| KW-001 | Nullify Impact | BattleSystem 未检测 NullifyKeyword 效果 |

### 7.3 架构限制

| 限制 | 说明 |
|------|------|
| 无持久化 | 无存档/读档 |
| 无 UI | 纯控制台 |
| 无 AI | 无自动对手 |
| 简化的 deepClone | `applyChanges` 用 JSON.parse(JSON.stringify())，对 Map/Set 支持有限 |

---

## 八、下一阶段目标

### Completed（已完成）✅

- [x] Batch 0-6：MVP 核心规则引擎（14 模块 + 20 张卡 + 181 tests）
- [x] 完整对战流程：出牌→攻击→阻挡→BP结算→伤害→Trigger→胜负
- [x] 9 种关键词展开系统
- [x] GameEngine 门面 + 场景脚本

### Planned（计划）🔲

- [ ] **Batch 7：Card Editor**（详见 `BATCH_7_CARD_EDITOR_DESIGN.md`）
  - CardEditorEngine（纯逻辑，可嵌入 Web 客户端）
  - Web UI（Vanilla HTML/JS，Express 静态服务）
  - Console CLI（readline 交互式创建向导）
  - 与 GameEngine 零耦合（仅依赖 types.ts + CardSystem）

- [ ] **后续阶段**（Roadmap Phase 3）
  - 前端 UI（Phaser + Canvas/WebGL）
  - AI 对战
  - 网络对战

### Not in Scope（不在范围内）❌

- [ ] 美术资源
- [ ] 账号系统
- [ ] 完整卡牌数据库（当前仅 20 张测试卡）
- [ ] DSL 能力解析器（当前用结构化 JSON）

---

> **入口文档**：本文件是 Phase 2 开发的上下文入口。
> 详细设计见：
> - `Architecture.md` — 完整模块架构（16 模块）
> - `ARCHITECTURE_DECISIONS.md` — 16 条架构决策
> - `BATCH_7_CARD_EDITOR_DESIGN.md` — Card Editor 设计
> - `DEVELOPMENT_BATCH_PLAN.md` — 各 Batch 详细计划
