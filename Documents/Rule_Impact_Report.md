# Union Arena — 规则裁决影响报告

> 日期：2026-08-03
> 基于：`Rule_Resolution.md` 9 条裁决结果（8 已确认，1 待查证）
>
> 本文档分析每条裁决对系统架构和模块设计的影响，并评估 MVP 范围。

---

## 一、裁决影响逐条分析

### RQ-001：When Played 触发范围 → 裁决 C

**裁决**："play" = 以任意方式从任意区域进入场上（最宽泛）

| 维度 | 内容 |
|------|------|
| **影响模块** | `AbilitySystem`（TriggerDetection）、`EventBus` |
| **设计变更** | `CARD_PLAYED` 事件的触发条件从"从手牌打出"扩大到"卡牌以任意方式进入场上" |
| **具体改动** | EventBus 的 `CARD_PLAYED` 事件需在以下场景均触发：Main Phase A 打出、Raid 入场、被效果从手牌/卡组/Sideline 等任意区域放入场上 |
| **复杂度** | 低 — 仅在事件触发点上统一处理，不涉及新逻辑 |
| **测试要点** | 验证效果 play 入场的卡触发 When Played；验证 Raid 入场的卡触发 When Played；验证"put onto field"的效果是否算"play" |

---

### RQ-002：入场角色攻击限制（召唤失调）→ 裁决 Other

**裁决**：Union Arena **不存在**召唤失调。攻击仅由 Active/Resting 状态决定。打出时默认 Resting → 不能攻击。Raid 切换 Active → 可以攻击。任何效果若将角色变为 Active，即可攻击。

| 维度 | 内容 |
|------|------|
| **影响模块** | `BattleSystem`、`RuleValidator` |
| **设计变更** | **简化** — 无需追踪"本回合入场"状态。攻击合法性的唯一条件是：前线 + Active + Attack Phase |
| **具体改动** | `canAttack()` 不检查入场回合；`RuleValidator` 中无需 `enteredFieldThisTurn` 字段；GameState 中 `CardOnField.enteredFieldThisTurn` 字段可以移除 |
| **复杂度** | 降低 — 移除了原本可能需要追踪的状态 |
| **测试要点** | 验证 Resting 角色不能攻击；验证 Raid 入场（切换 Active）后可以攻击；验证效果将角色变为 Active 后可以攻击 |

---

### RQ-003：Start Phase 持续性效果清除顺序 → 裁决 A

**裁决**：所有到期效果同时清除，不存在中间状态。

| 维度 | 内容 |
|------|------|
| **影响模块** | `DurationManager` |
| **设计变更** | **简化** — 无需实现排序逻辑。到期效果批量收集 → 一次性全部移除 |
| **具体改动** | `DurationManager.expireEffects()` 实现为：收集所有到期效果 → snapshot 当前状态 → 批量清除 → 单次状态变更 |
| **复杂度** | 降低 — 不需要优先级排序、不需要分步清除 |
| **测试要点** | 验证两个互不相关的到期效果同时清除时互不影响；验证清除不触发中间事件 |

---

### RQ-004：Raid 描述能力在普通打出时的失效范围 → 裁决 A

**裁决**：Raid 描述框内的**全部内容**仅在 Raid 打出时生效。普通打出时整个框内内容不生效。

| 维度 | 内容 |
|------|------|
| **影响模块** | `CardSystem`（卡牌数据模型）、`RaidSystem` |
| **设计变更** | 卡牌 JSON 中 Raid 专属能力必须从 `abilities[]` 中分离，存储在 `raid.raidAbilities[]` 中 |
| **具体改动** | Card_System.md §2.3 和 §6.1 已更新；CardSystem 加载时需验证 raidAbilities 与 abilities 分离；RaidSystem 在 Raid 打出时合并两组能力注册 |
| **复杂度** | 中 — 卡牌数据结构变更，引擎加载逻辑需适配 |
| **测试要点** | 验证普通打出的 Raid 卡不触发 raidAbilities；验证 Raid 打出的卡同时拥有 abilities 和 raidAbilities；验证卡牌数据验证器拒绝将 Raid 能力放在 abilities[] 中 |

---

### RQ-005：Energy Line + 标记的行为 → 裁决 B

**裁决**：加号表示该卡自身拥有可增加能量生成量的能力。有加号 = 该卡的 abilities 中存在修改能量生成的效果。

| 维度 | 内容 |
|------|------|
| **影响模块** | `EnergySystem`、`CardSystem` |
| **设计变更** | `hasPlus` 的语义从"装饰性标记"变为"功能标记" — EnergySystem 需要检查有 hasPlus 标记的卡上的能力，以计算实际能量生成量 |
| **具体改动** | `EnergySystem.calculateEnergy()`: 对每个 hasPlus=true 的卡，检查其 abilities 中是否有修改能量生成的效果，应用修正。BP 的 hasPlus 同理。 |
| **复杂度** | 低-中 — 主要是 EnergySystem 增加一步能力检查 |
| **测试要点** | 验证无能力的 hasPlus 卡能量生成量 = 基础值；验证有能力增加能量生成的 hasPlus 卡正确计算；验证无 hasPlus 的卡即使有能力也无法增加能量生成 |

---

### RQ-006：End Phase 手牌上限弃牌选择权 → 裁决 A

**裁决**：手牌持有者本人选择保留哪些。

| 维度 | 内容 |
|------|------|
| **影响模块** | `TurnManager` |
| **设计变更** | **无需变更** — 与架构设计中的推断一致 |
| **具体改动** | 无 |
| **复杂度** | 无影响 |
| **测试要点** | 验证弃牌选择权在持有者 |

---

### RQ-007：攻击阶段 Trigger 是否算"使用卡牌" → 裁决 A

**裁决**：Trigger 不算"使用卡牌"，是独立机制。攻击阶段可正常发动 Trigger 能力。

| 维度 | 内容 |
|------|------|
| **影响模块** | `RuleValidator`、`TriggerSystem` |
| **设计变更** | RuleValidator 的 Attack Phase 规则中需明确：禁止"使用卡牌"不包含 Trigger 能力发动 |
| **具体改动** | `RuleValidator` 中 Attack Phase 的禁止列表增加注释/例外：Trigger 能力允许；或 TriggerSystem 绕过常规的"能否使用卡牌"检查 |
| **复杂度** | 低 — 增加一条例外规则 |
| **测试要点** | 验证 Attack Phase 中 Trigger 能力正常发动；验证 Attack Phase 中不能使用 Event 卡 |

---

### RQ-008：先手第一回合限制 → 裁决 B

**裁决**：Player One 的第一回合**不能进入 Attack Phase**。Main Phase 结束后直接进入 End Phase。先手第一回合可以正常使用卡牌和发动能力。

| 维度 | 内容 |
|------|------|
| **影响模块** | `TurnManager` |
| **设计变更** | TurnManager 需增加判断：当 `turnNumber == 1 && currentPlayer == PlayerOne` 时，Main Phase 结束后跳过 Attack Phase，直接进入 End Phase |
| **具体改动** | 状态机增加条件分支；UI 层不显示"进入攻击阶段"按钮（阶段 3 才需要） |
| **复杂度** | 低 — 一个条件判断 |
| **测试要点** | 验证 Player One Turn 1 Main Phase → End Phase（无 Attack Phase）；验证 Player Two Turn 1 正常有 Attack Phase；验证 Turn 2+ 双方正常有 Attack Phase |

---

### RQ-009：新触发能力的队列插入位置 → 裁决 D（待查证）

**裁决**：需要查阅官方 FAQ 或日文原文。**当前无法确定。**

| 维度 | 内容 |
|------|------|
| **影响模块** | `AbilitySystem`（AbilityQueue） |
| **设计变更** | AbilityQueue 实现需保留灵活性，支持两种模式切换 |
| **具体改动** | 将队列排序策略抽象为可配置项：`QueueStrategy.FLAT`（选项A：统一池） vs `QueueStrategy.PRIORITY_BATCH`（选项B：保持归属优先级）。默认采用**选项B**（保持归属优先级，更保守安全），待 FAQ 确认后调整 |
| **复杂度** | 中 — 需要策略模式抽象 |
| **测试要点** | 两种策略均可切换；默认策略行为正确 |

---

## 二、模块影响矩阵

| 模块 | RQ-001 | RQ-002 | RQ-003 | RQ-004 | RQ-005 | RQ-006 | RQ-007 | RQ-008 | RQ-009 | 变更量 |
|------|--------|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| **CardSystem** | — | — | — | 🟡 中 | 🟡 中 | — | — | — | — | **中** |
| **GameState** | — | 🟢 简化 | — | — | — | — | — | — | — | **简化** |
| **TurnManager** | — | — | — | — | — | ✅ 确认 | — | 🟡 中 | — | **低** |
| **AbilitySystem** | 🟢 低 | — | — | — | — | — | — | — | 🟡 中 | **中** |
| **BattleSystem** | — | 🟢 简化 | — | — | — | — | — | — | — | **简化** |
| **RuleValidator** | — | 🟢 简化 | — | — | — | — | 🟢 低 | — | — | **低** |
| **EnergySystem** | — | — | — | — | 🟢 低 | — | — | — | — | **低** |
| **RaidSystem** | — | — | — | 🟡 中 | — | — | — | — | — | **中** |
| **DurationManager** | — | — | 🟢 简化 | — | — | — | — | — | — | **简化** |
| **EventBus** | 🟢 低 | — | — | — | — | — | — | — | — | **低** |
| **TriggerSystem** | — | — | — | — | — | — | 🟢 低 | — | — | **低** |
| **DeckBuilder** | — | — | — | — | — | — | — | — | — | 无 |
| **MovementSystem** | — | — | — | — | — | — | — | — | — | 无 |
| **DamageSystem** | — | — | — | — | — | — | — | — | — | 无 |
| **StateHistory** | — | — | — | — | — | — | — | — | — | 无 |
| **ActionSystem** | — | — | — | — | — | — | — | — | — | 无 |
| **GameEngine** | — | — | — | — | — | — | — | — | — | 无 |

**图例**：🟢 低/简化 = 工作量小或减少工作量 | 🟡 中 = 需要一定量的设计/代码变更 | 🔴 高 = 需要大量重新设计

---

## 三、MVP 评估

### 3.1 MVP 定义

MVP（Minimum Viable Product）= 能够完成一局完整游戏的最小模块集合。

MVP 游戏流程：
```
Setup → Start Phase → Movement Phase → Main Phase → Attack Phase → End Phase → 循环 → 胜利判定
```

### 3.2 模块 MVP 就绪度

| 模块 | MVP 需要？ | 裁决影响 | 就绪度 | 备注 |
|------|-----------|---------|--------|------|
| **CardSystem** | ✅ 必须 | RQ-004, RQ-005 影响数据结构 | 🟡 需要调整 | raidAbilities 分离、hasPlus 语义 |
| **GameState** | ✅ 必须 | RQ-002 简化 | 🟢 就绪 | 可移除 enteredFieldThisTurn |
| **EventBus** | ✅ 必须 | RQ-001 影响事件触发点 | 🟢 就绪 | 小调整 |
| **TurnManager** | ✅ 必须 | RQ-008 新增限制 | 🟢 就绪 | 增加一个条件分支 |
| **EnergySystem** | ✅ 必须 | RQ-005 影响计算逻辑 | 🟢 就绪 | hasPlus → 能力检查 |
| **AbilitySystem** | ✅ 必须 | RQ-001, RQ-009 影响 | 🟡 需策略模式 | RQ-009 待查证，需保留灵活性 |
| **BattleSystem** | ✅ 必须 | RQ-002 简化, RQ-007 | 🟢 就绪 | 简化了攻击条件 |
| **RuleValidator** | ✅ 必须 | RQ-002 简化, RQ-007 | 🟢 就绪 | 小调整 |
| **TriggerSystem** | ✅ 必须 | RQ-007 | 🟢 就绪 | 确认 Attack Phase 允许 |
| **DamageSystem** | ✅ 必须 | 无影响 | 🟢 就绪 | — |
| **MovementSystem** | ✅ 必须 | 无影响 | 🟢 就绪 | — |
| **DurationManager** | ✅ 必须 | RQ-003 简化 | 🟢 就绪 | 批量清除 |
| **RaidSystem** | ⚠️ MVP+ | RQ-004 影响数据结构 | 🟡 可推迟 | Raid 是重要机制但非阻塞 |
| **StateHistory** | ⚠️ MVP+ | 无影响 | 🟢 就绪 | 调试/测试需要 |
| **ActionSystem** | ✅ 必须 | 无直接影响 | 🟢 就绪 | — |
| **DeckBuilder** | ⚠️ MVP+ | 无影响 | 🟢 就绪 | 可先手动组卡 |
| **GameEngine** | ✅ 必须 | 无直接影响 | 🟢 就绪 | — |

### 3.3 MVP 判定

**结论：全部 MVP 核心模块均可进入开发，无阻塞项。**

RQ-009（队列插入位置）是唯一未解决的疑点，但 MVP 阶段可采用保守策略（选项B：保持归属优先级），后续根据 FAQ 调整。该策略不影响 MVP 功能完整性。

---

## 四、裁决带来的简化

相比原始架构设计，以下模块因裁决而**降低**了复杂度：

| 模块 | 原本设计 | 裁决后 | 节省 |
|------|---------|--------|------|
| `BattleSystem` | 需要追踪入场回合判断召唤失调 | 仅检查 Active 状态 | 移除 1 个状态字段 + 1 个检查条件 |
| `DurationManager` | 可能需要排序/优先级清除 | 批量同时清除 | 移除排序逻辑 |
| `RuleValidator` | 需要 enteredFieldThisTurn 判断 | 无需此字段 | 移除 1 个验证规则 |
| `GameState` | CardOnField 有 enteredFieldThisTurn | 移除此字段 | 简化数据模型 |

---

## 五、待解决问题

| 编号 | 问题 | 阻塞模块 | 风险等级 | 临时方案 |
|------|------|---------|---------|---------|
| RQ-009 | 新触发能力队列插入位置 | AbilityQueue | 低 | 默认采用选项B（保持归属优先级），以策略模式封装，后续可切换 |

**行动计划**：
1. 查阅 Union Arena 官方 FAQ / 日文规则原文
2. 在官方社区 / 论坛确认
3. 若 MVP 完成前未能确认 → 以选项B（更保守）发布
4. 若后续确认选项A正确 → 切换策略模式即可，不影响其他模块

---

## 六、更新文档清单

| 文档 | 更新内容 | 状态 |
|------|---------|------|
| `Rule_Resolution.md` | 8/9 条状态标记 + 汇总表 | ✅ 已更新 |
| `Architecture.md` §2.3 | TurnManager: 先手第一回合限制 (RQ-008) | ✅ 已更新 |
| `Architecture.md` §8.4 | 规则疑点确认状态表 (替代原列表) | ✅ 已更新 |
| `Battle_System.md` §1.3 | 召唤失调澄清 (RQ-002) + Trigger 例外 (RQ-007) | ✅ 已更新 |
| `Battle_System.md` §7 | Trigger 在 Attack Phase 允许 (RQ-007) | ✅ 已更新 |
| `Card_System.md` §2.3 | Raid 数据结构分离 (RQ-004) + hasPlus 语义 (RQ-005) | ✅ 已更新 |
| `Card_System.md` §4.3 | When Played 触发范围 (RQ-001) | ✅ 已更新 |
| `Card_System.md` §6.1 | Raid 能力分离存储 (RQ-004) | ✅ 已更新 |
| `Rule_Impact_Report.md` | 本文件 | ✅ 已创建 |

---

> **下一步**：进入 Batch 0 — 项目骨架搭建 + 卡牌 JSON Schema 定义（含 RQ-004 raidAbilities 分离和 RQ-005 hasPlus 语义）。
