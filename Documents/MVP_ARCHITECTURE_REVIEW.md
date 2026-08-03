# Union Arena Digital — MVP 架构审查报告

> 日期：2026-08-04
> 审查阶段：Batch 5 完成后，Batch 6 集成前
> 审查范围：RaidSystem / KeywordSystem / Game Flow / 规则依赖

---

## 一、RaidSystem 审查

### 1.1 Raid Stack 离场规则

**规则书原文** (§When a Raided Character on the Field Moves to a Destination Other than the Field)：

> "When a Raided character moves to a destination other than the field, move only the top card to that destination. Place the underlying card(s) into your sideline. Those cards are not treated as having been sidelined."

**当前实现** (`RaidSystem.handleRaidCardLeaving`)：

```typescript
// 顶层卡 — 将底层卡送入 Sideline
changes.push({
  type: 'MOVE_CARD',
  instanceId: card.raiding,       // 底层卡的 instanceId
  from: 'FrontLine',              // 🔴 硬编码为 FrontLine
  to: 'Sideline',
  playerId: player.playerId,
});
```

**审查结论**：⚠️ **部分正确，存在两个缺陷**

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 顶层卡去目标区域 | ❌ 未实现 | `handleRaidCardLeaving` 只处理底层卡到 Sideline，**没有处理顶层卡的去向**。调用方需要额外 MOVE_CARD 顶层卡 |
| 底层卡进 Sideline | ✅ | `card.raiding` 正确指向底层卡 |
| 底层卡不算 Sidelined | ✅ | 使用普通 `MOVE_CARD` 而非 `SIDELINE_CHARACTER` |
| `from` 区域动态检测 | 🔴 错误 | 硬编码 `'FrontLine'`，但如果 Raid 卡在 `EnergyLine` 上则 from 区域不正确 |

**建议修复（Batch 6）**：
1. `handleRaidCardLeaving` 应同时返回顶层卡和底层卡的 MOVE_CARD
2. `from` 区域应动态检测（检查底层卡实际所在区域）

### 1.2 Raid 能力与普通能力隔离

**规则书原文**：

> "Cards with Raid may also be played normally. However, any abilities contained within the Raid description are lost."

> RQ-004 裁决：Raid 描述框内的全部内容仅在 Raid 打出时生效。普通打出时整个框内内容不生效。

**当前实现**：

卡牌数据结构中 `raid.raidAbilities[]` 与 `abilities[]` 分离存储：

```json
{
  "abilities": [{ "abilityId": "HTR-1-018-ABL-1", "timing": "WhenPlayed", ... }],
  "raid": {
    "raidAbilities": [
      { "abilityId": "RAID-ACTIVE", "timing": "WhenPlayed", "effects": ["SwitchToActive"] },
      { "abilityId": "RAID-FRONT", "timing": "WhenPlayed", "effects": ["MoveToFrontLine"] }
    ]
  }
}
```

**审查结论**：⚠️ **数据结构正确分离，但运行时隔离存在风险**

| 风险点 | 严重度 | 说明 |
|--------|--------|------|
| ActionSystem 未集成 Raid | 🔴 高 | `ActionSystem.submitAction` 中**没有 `PerformRaid` handler**。RaidSystem 已实现但未被 ActionSystem 调用 |
| 普通打出时 raidAbilities 不注册 | 🟡 中 | 依赖于 ActionSystem 的 `handlePlayCharacter` 在注册能力时只使用 `cardData.abilities`，不包含 `cardData.raid.raidAbilities`。这个行为是**隐式的**，没有显式测试保护 |
| Raid 打出时能力合并 | 🟡 中 | Raid 打出后需要通过 `detectTriggeredAbilitiesWithRegistry` 检测能力。但 RaidSystem.performRaid 生成 CardPlayed 事件后，由 ActionSystem 调用 AbilitySystem 检测 — **当前 ActionSystem 无 PerformRaid handler，整条链路未串通** |

**建议（Batch 6）**：
1. ActionSystem 增加 `handlePerformRaid` 方法
2. `handlePlayCharacter` 中增加显式断言：普通打出时**排除** `cardData.raid?.raidAbilities`
3. `handlePerformRaid` 中显式合并 `[...cardData.abilities, ...cardData.raid.raidAbilities]`

### 1.3 普通登场触发 Raid 能力的风险

**当前保护机制**：
- 数据结构层面：`raidAbilities` 与 `abilities` 分离 ✅
- 加载层面：CardSystem 不展开 raidAbilities 到 abilities ✅
- 运行时层面：AbilitySystem.detectTriggeredAbilities 只读取 `cardData.abilities`，不读取 `cardData.raid.raidAbilities` ✅

**审查结论**：✅ **数据结构层面已隔离。运行时层面依赖 ActionSystem 集成确认（见 1.2）。**

---

## 二、KeywordSystem 审查

### 2.1 当前展开方案

```
Card JSON (keywords:["Snipe"]) → expandKeywords → abilities[] += keyword abilities → CardRegistry
```

9 种关键词全部展开为 `AbilityData[]`，追加到卡牌的 `abilities[]`。

### 2.2 关键词分类分析

审查发现，当前 9 种关键词实际上属于 **三个不同类别**：

| 类别 | 关键词 | 当前实现方式 | 问题 |
|------|--------|-------------|------|
| **Ability 类** | Snipe, Impact 1, Impact +1 | 展开为 AbilityData → AbilitySystem 处理 | ✅ 正确，这些是"在特定时机触发的效果" |
| **Battle Modifier 类** | Damage 2, Damage +1, Nullify Impact | 展开为 AbilityData → AbilitySystem + BattleSystem 分别处理 | ⚠️ 见下方 |
| **Rule Modifier 类** | Double Attack, Double Block, Step | 展开为 AbilityData → 部分被硬编码检测 | 🔴 见下方 |

#### Battle Modifier 类问题

`Damage 2` / `Damage +1` / `Nullify Impact` 是**战斗规则的被动修正**，不是"触发式能力"。

| 关键词 | 当前展开 | 实际结算位置 | 问题 |
|--------|---------|-------------|------|
| Damage 2 | AbilityData(timing=WhenNotBlocked) | `DamageSystem.extractDamageModifiers` 从 effects 提取 | AbilitySystem 不会真正"触发"它 — 它被 BattleSystem 硬编码扫描 |
| Damage +1 | 同上 | 同上 | 同上 |
| Nullify Impact | AbilityData(timing=DuringBattle) | **未实现** — BattleSystem 中无 Nullify Impact 检测 | 🔴 功能缺失 |

**影响**：这些关键词的 AbilityData 被加载到 `abilities[]` 但 **AbilitySystem 的 TriggerDetector 无法匹配它们的 timing**：
- `WhenNotBlocked` — TIMING_EVENT_MAP 中无此映射
- `DuringBattle` — TIMING_EVENT_MAP 中无此映射

这些效果实际上不是通过 AbilitySystem 结算的，而是通过 **BattleSystem/DamageSystem 硬编码扫描 abilities 中的特定 effectType**。

#### Rule Modifier 类问题

| 关键词 | 当前展开 | 实际结算位置 | 问题 |
|--------|---------|-------------|------|
| Double Attack | AbilityData(timing=EndOfBattle, effect=DoubleAttack) | `BattleSystem.endBattle` 硬编码检测 `effectType === 'DoubleAttack'` | AbilitySystem 不触发 |
| Step | AbilityData(timing=MovementPhase, effect=AllowReverseMovement) | MovementSystem 未集成 | 🔴 功能缺失 |

**审查结论**：⚠️ **关键词展开方案导致 AbilitySystem 与 BattleSystem/MovementSystem 之间的责任边界模糊**

当前 9 种关键词展开为统一的 `AbilityData[]`，但实际上：
- **3 种** (Snipe, Impact 1, Impact +1) 应通过 AbilitySystem 的 EventBus 触发机制正常结算
- **4 种** (Damage 2, Damage +1, Double Attack, Nullify Impact) 应归类为 **Battle Modifier**，由 BattleSystem/DamageSystem 在战斗结算时直接查询
- **1 种** (Double Block) 与 Double Attack 同类，但未实现
- **1 种** (Step) 应归类为 **Rule Modifier**，由 MovementSystem 查询

### 2.3 是否会导致 AbilitySystem 过度膨胀

**当前影响**：**不会。** 原因是大部分关键词展开后实际**不被 AbilitySystem 的 TriggerDetector 匹配**（它们的 timing 不在 TIMING_EVENT_MAP 中），所以不会增加 AbilityQueue 的负担。

但存在**语义混淆**：这些关键词以 `AbilityData` 形式存储，开发者阅读代码时会误以为它们通过 AbilitySystem 结算。

### 2.4 建议（Batch 6+）

```
短期（Batch 6）：
  - 保持当前展开方案不变（已验证等价性）
  - 在 ARCHITECTURE_DECISIONS.md 中记录关键词分类
  - 补全 TIMING_EVENT_MAP 缺失映射

长期（架构优化）：
  - 将关键词定义拆分为三类：
    keyword_definitions.json:
      abilities:    Snipe / Impact 1 / Impact +1  → AbilityData[]
      battleMods:   Damage 2 / Damage +1 / Nullify Impact / Double Attack / Double Block → BattleModifier[]
      ruleMods:     Step → RuleModifier[]
  - BattleSystem/DamageSystem 直接读取 battleMods，不通过 AbilitySystem
  - MovementSystem 直接读取 ruleMods
```

---

## 三、Game Flow — E2E 测试设计

### 3.1 完整对局流程

```
测试名称：Full Game E2E — Player One 胜利路径

卡组配置：
  P1: HTR-1-001×4, HTR-1-002×4, HTR-1-004×4, HTR-1-005×4, HTR-1-007×4, HTR-1-014×4,
      HTR-1-015×4, HTR-1-017×4, HTR-1-019×4, HTR-1-006×4, HTR-1-011×4, HTR-1-012×2 (=50)
  P2: 同上 (=50)

游戏流程：
```

#### Turn 1 (PlayerOne, 先手) — 准备

```
Setup → Start → Movement → Main → End (RQ-008: 无Attack)

Start Phase:
  - P1 hand=7 (先手不抽牌)
  - P1 AP=1

Movement Phase:
  - 跳过（无卡在能量线）

Main Phase:
  - P1 打出 HTR-1-005 (Site, 白×1, AP=1) → 能量线
    → AP: 1→0
    → 能量线: 1张 (白×1)

End Phase:
  - 切换至 P2 Turn 1
```

#### Turn 2 (PlayerTwo) — 建立场面

```
Start → Movement → Main → Attack → End

Start Phase:
  - P2 抽 1 张 (hand: 7→8)
  - P2 AP: 2

Movement Phase:
  - 跳过

Main Phase:
  - P2 打出 HTR-1-005 (Site, 白×1, AP=1) → 能量线 → AP: 2→1
  - P2 打出 HTR-1-002 (4000BP, 白×1, AP=1) → 前线 → AP: 1→0
    → P2 前线: 1张(HTR-1-002, Resting, BP=4000)

Attack Phase:
  - P2 无 Active 角色 → 阶段立即结束

End Phase:
  - HTR-1-002: Resting→Active
  - 切换至 P1 Turn 2
```

#### Turn 3 (PlayerOne Turn 2) — 建立场面 + Raid

```
Start Phase:
  - P1 抽 1 张 (hand: 6→7)
  - P1 AP: 1→2

Movement Phase:
  - 跳过

Main Phase:
  - P1 打出 HTR-1-001 (3000BP, 白×1, AP=1) → 前线 → AP: 2→1
    → P1 前线: 1张(HTR-1-001, Resting, BP=3000)
  - P1 Raid 打出 HTR-1-017 (target: HTR-1-001, 红×1, AP=1) → AP: 1→0
    → 堆叠在 HTR-1-001 上 → Active
    → WhenPlayed: (raidAbilities) SwitchToActive + MoveToFrontLine
    → P1 前线: HTR-1-017(Active, BP=4000) 堆叠在 HTR-1-001 上

Attack Phase:
  - P1 declareAttack(HTR-1-017 → P2 Player)
    → HTR-1-017: Active→Resting
    → BattleState: AttackerDeclaration → BlockerDeclaration
  - P2 选择不阻挡 (skipBlock)
    → 直接伤害 1 点
    → P2 生命区: 7→6
    → 翻 1 张生命卡 → Trigger 检查
    → 如果有 Trigger → 自动发动 → Sideline
  - BattleState 清除

End Phase:
  - HTR-1-017: Resting→Active
  - 切换至 P2 Turn 2
```

#### Turn 4 (PlayerTwo Turn 2) — 阻挡战斗

```
Start Phase:
  - P2 抽 1 张 → AP: 0→2

Main Phase:
  - P2 打出 HTR-1-004 (5000BP, 白×2, AP=1) → 前线 → AP: 2→1
    → P2 前线: HTR-1-002(Active, BP=4000) + HTR-1-004(Resting, BP=5000)

Attack Phase:
  - P2 declareAttack(HTR-1-002 → P1 Player)
    → HTR-1-002: Active→Resting
  - P1 declareBlock(HTR-1-017)
    → HTR-1-017: Active→Resting
    → BP比较: HTR-1-002(4000) vs HTR-1-017(4000)
    → 4000 >= 4000 → 攻方胜
    → HTR-1-017 Sideline
    → 底层卡 HTR-1-001 → Sideline
    → Impact 检查: HTR-1-002 无 Impact

End Phase:
  - 切换至 P1 Turn 3
```

#### Turn 5 (PlayerOne Turn 3) — Impact + Damage 2 + 胜利

```
Start Phase:
  - P1 抽 1 张
  - P1 AP: 0→3

Main Phase:
  - P1 打出 HTR-1-014 (4000BP, 白×1, AP=1, keywords:[Impact 1]) → 前线 → AP: 3→2
  - P1 打出 HTR-1-015 (3500BP, 白×1, AP=1, keywords:[Damage 2]) → 前线 → AP: 2→1

Attack Phase:
  - P1 declareAttack(HTR-1-014 → P2 Player)
    → Impact 1 能力注册
  - P2 无 Active 角色可阻挡 (HTR-1-002 和 HTR-1-004 均为 Resting)
  - P2 skipBlock
    → 直接伤害 1 点 → P2 生命: 6→5
    → Trigger 检查 → Sideline
  - BattleState 清除
  - HTR-1-014 仍为 Resting

  - P1 declareAttack(HTR-1-015 → P2 Player)
    → Damage 2 能力注册
  - P2 skipBlock
    → 直接伤害 = 2 (Damage 2)
    → P2 生命: 5→3
    → 翻 2 张生命卡 → Trigger 检查 (逐个) → Sideline

  - [继续攻击至 P2 生命为 0...]

  - P2 生命区 = 0 → P1 胜利
    → winner = "player-1"
    → phase = "GameOver"
```

### 3.2 验证点清单

```
[ ] P1 Turn 1: 5 阶段全流转（无 Attack）
[ ] P1 Turn 1: Main Phase 打出 Site + Character
[ ] P1 Turn 2: Raid 成功堆叠 → Active → WhenPlayed
[ ] P1 Turn 2: Raid 后角色可攻击 (RQ-002)
[ ] P1 Turn 2: 攻击 → 无阻挡 → 1 点伤害 → Trigger
[ ] P2 Turn 2: 攻击 → P1 阻挡 → BP 比较
[ ] BP 比较: 4000 >= 4000 → 攻方胜 → 阻挡者 Sideline
[ ] Raid 卡被 Sideline → 底层卡也进入 Sideline
[ ] Damage 2: 未被阻挡 → 2 点伤害 → 翻 2 张生命卡
[ ] Impact 1: 战斗获胜 → 额外 1 点伤害
[ ] WhenPlayed: 各卡打出时 Draw1 / BP Buff 正确触发
[ ] Double Attack: 首次攻击后恢复 Active
[ ] 胜利判定: 生命区=0 → winner 设置 + GameOver
[ ] 牌库空判定: Start Phase 抽牌时牌库空 → 对方胜利
```

### 3.3 当前串联能力评估

| 系统 | E2E 串联状态 |
|------|-------------|
| GameState.create | ✅ 可初始化 |
| TurnManager.advancePhase | ✅ 5阶段流转 |
| CardSystem.load + expandKeywords | ✅ 加载+关键词展开 |
| ActionSystem.submitAction (PlayCharacter) | ✅ 打出角色 |
| ActionSystem.submitAction (PlaySite) | ✅ 打出Site |
| ActionSystem.submitAction (UseEvent) | ✅ 使用Event |
| **ActionSystem.submitAction (PerformRaid)** | 🔴 **未实现 — Batch 6 必须** |
| ActionSystem.submitAction (ActivateAbility) | ✅ 发动能力 |
| AbilitySystem (WhenPlayed) | ✅ 自动触发 |
| BattleSystem.declareAttack | ✅ 攻击宣言 |
| BattleSystem.declareBlock | ✅ 阻挡宣言 |
| BattleSystem.resolveBattle | ✅ BP比较+伤害+Trigger |
| DamageSystem.dealDamage | ✅ 伤害计算 |
| TriggerSystem.processTriggers | ✅ Trigger 结算 |
| 胜负判定 (checkWinCondition) | ✅ ActionSystem 内部有实现 |
| **Double Attack / Step / Nullify Impact** | 🔴 **部分未集成 — Batch 6** |

---

## 四、规则依赖标记

### 4.1 已通过规则裁决确认

| 编号 | 问题 | 裁决 | 实现状态 |
|------|------|------|---------|
| RQ-001 | WhenPlayed 触发范围 | C: 任意方式入场即触发 | ✅ |
| RQ-002 | 入场角色攻击限制 | 无召唤失调，Active/Resting决定 | ✅ |
| RQ-003 | Start Phase 效果清除顺序 | A: 同时清除 | ✅ |
| RQ-004 | Raid 描述能力失效范围 | A: 框内全部内容仅Raid生效 | ✅ 数据分离 |
| RQ-005 | Energy Line +标记行为 | B: 自身能力可能改变能量生成 | ⏳ B3+ |
| RQ-006 | 手牌上限弃牌选择权 | A: 持有者本人 | ✅ |
| RQ-007 | Attack Phase Trigger | A: Trigger不算使用卡牌 | ✅ |
| RQ-008 | 先手第一回合限制 | B: 不能进入Attack Phase | ✅ |

### 4.2 仍然依赖规则书确认

| 编号 | 问题 | 影响系统 | 当前临时方案 |
|------|------|---------|-------------|
| **RQ-009** | 新触发能力队列插入位置 | AbilityQueue | 选项B（归属优先级），策略模式预留 |
| **DM-001** | Damage 2 + Damage +1 叠加 | DamageSystem | multiplier + bonus 叠加（=3），待确认 |
| **DM-002** | 多个 Damage +1 叠加 | DamageSystem | 累加 |
| **KW-001** | Impact +1 无 Impact 时行为 | KeywordSystem | 展开为 DealDamage(1, bonus=true)，但"bonus"语义不精确 |
| **BT-001** | WhenAttacking BP Buff 在 BP 比较时是否快照 | BattleSystem | 当前使用 currentBP（实时值），非宣言时快照 |
| **BT-002** | Double Attack 首次攻击条件 | BattleSystem | 简化为检测 effectType='DoubleAttack'，未实现 IsFirstAttackThisTurn 条件 |
| **MV-001** | Step 逆向移动目标满位 → 交换 or 移除 | MovementSystem | 未实现（Step 关键词在 MovementSystem 中未集成） |
| **TR-001** | Trigger 发动选择权 | TriggerSystem | MVP 自动发动，未实现玩家选择接口 |

### 4.3 Batch 6 必须解决

| 优先级 | 问题 | 说明 |
|--------|------|------|
| 🔴 P0 | ActionSystem PerformRaid handler | 缺失 — E2E 无法测试 Raid |
| 🔴 P0 | RaidSystem 离场 from 区域动态检测 | 硬编码 FrontLine → 可能状态不一致 |
| 🟡 P1 | GameEngine 门面类 | 封装所有系统 → E2E 脚本入口 |
| 🟡 P1 | 场景脚本 | 至少 4 个预定义场景 |
| 🟢 P2 | Double Attack IsFirstAttackThisTurn | 条件未实现 → 每场战斗都触发 |

---

## 五、总结

### 整体评估

| 维度 | 状态 | 评分 |
|------|------|------|
| 数据结构设计 | 卡牌JSON→CardData→CardInZone/CardOnField 链路完整 | ✅ 优秀 |
| 状态管理 | 不可变 GameState + StateChange pipeline | ✅ 优秀 |
| 模块分离 | 13个系统职责边界基本清晰 | ✅ 良好 |
| 规则覆盖 | 8/9 RQ已确认并实现, DM-001/002待确认 | ⚠️ 良好 |
| E2E 串联 | 主要流程可串联，3个集成缺口 | ⚠️ 中等 |

### Batch 6 关键任务

1. **ActionSystem 集成 Raid** — `handlePerformRaid` 方法
2. **RaidSystem.handleRaidCardLeaving 修复** — from 区域动态检测 + 顶层卡去向
3. **GameEngine 门面类** — 封装所有系统的初始化+操作入口
4. **E2E 场景脚本** — 按 §3 设计实现完整对局
5. **MovementSystem Step 集成** — AllowReverseMovement 效果支持
6. **Double Attack 条件完善** — IsFirstAttackThisTurn 追踪

---

> **关联文档**：
> - `ARCHITECTURE_DECISIONS.md` — 已记录架构决策 (AD-001 ~ AD-016)
> - `Rule_Resolution.md` — 9条规则裁决 (8/9 已确认)
> - `DEVELOPMENT_BATCH_PLAN.md` — Batch 6 详细计划
