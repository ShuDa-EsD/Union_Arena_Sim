# Union Arena Digital — Batch 0 类型审查报告

> 版本：1.0
> 审查日期：2026-08-04
> 审查范围：`src/core/types.ts`（Batch 0 产出）
> 审查依据：Architecture.md §3 / Card_System.md §2-§4 / Game_Design.md / DEVELOPMENT_BATCH_PLAN.md
>
> **原则：只分析，不修改代码。**

---

## 一、需求覆盖度分析

### 1.1 能否表示核心游戏实体？

| 实体 | 对应类型 | 状态 | 备注 |
|------|---------|------|------|
| **玩家** | `PlayerState` | ✅ 满足 | playerId / playerOrder / 全区域。缺少显示名称，但对 MVP 够用 |
| **卡组** | `PlayerState.deck: CardInZone[]` | ✅ 满足 | 50 张 `CardInZone`，通过 cardId 关联数据 |
| **手牌** | `PlayerState.hand: CardInZone[]` | ✅ 满足 | 初始 7 张，上限 8 张 |
| **前线** | `PlayerState.frontLine: CardOnField[]` | ✅ 满足 | 容量 4，角色卡 `CardOnField` 含 state/BP/堆叠 |
| **能量线** | `PlayerState.energyLine: CardOnField[]` | ✅ 满足 | 容量 4，角色/Site 混合 |
| **生命区** | `PlayerState.lifeArea: CardInZone[]` | ✅ 满足 | 初始 7 张，背面朝上 |
| **AP 区** | `PlayerState.apArea: CardOnField[]` | ⚠️ 可用 | AP 卡复用 `CardOnField`（currentBP/raidedBy 无意义但无害） |
| **Sideline** | `PlayerState.sideline: CardInZone[]` | ✅ 满足 | 公开弃牌区，无容量限制 |
| **Removal** | `PlayerState.removalArea: CardInZone[]` | ✅ 满足 | 永久移除区 |
| **能量池** | `PlayerState.energyPool: Record<string, number>` | ✅ 满足 | 按颜色汇总的缓存值 |
| **可用 AP** | `PlayerState.availableAP: number` | ✅ 满足 | 派生值，由 apArea 中 Active 数量决定 |
| **卡牌实例** | `CardInZone` / `CardOnField` | ✅ 满足 | 运行时唯一 instanceId + cardId 关联数据 |

**结论**：全部 13 个核心游戏实体均可表示。AP 区的类型复用是已知的轻微不完美，但不阻塞任何功能。

### 1.2 能否表示"一个玩家 + 8 张手牌 + 1 张角色在前线"？

```typescript
const player: PlayerState = {
  playerId: 'p1',
  playerOrder: 'PlayerOne',
  deck: [/* 42 cards */],
  hand: [/* 8 CardInZone */],
  frontLine: [{
    cardId: 'HTR-1-001',
    instanceId: 'inst-1-a1b2',
    ownerId: 'p1',
    faceUp: true,
    state: 'Active',
    currentBP: 3000,
    raidedBy: null,
    raiding: null,
  }],
  energyLine: [],
  lifeArea: [/* 7 cards */],
  apArea: [/* ... */],
  sideline: [],
  removalArea: [],
  energyPool: { '白': 0 },
  availableAP: 1,
};
```

✅ 可以。所有必要字段都存在。

---

## 二、未来系统支持度分析

### 2.1 CardSystem（Batch 1）— 支持度：⚠️ 基本满足，缺少 2 个字段

| CardSystem 需求 | 当前类型 | 评估 |
|---------------|---------|------|
| 加载卡牌 JSON → 解析为 `CardData` | `CardData` 接口 | ✅ |
| 验证必填字段 | cardId / cardName / cardType / requiredEnergy / apCost | ⚠️ 见下方 |
| 角色卡 BP | `CardData.bp?: { base: number }` | ✅ |
| 能量生成 | `CardData.energyGeneration?` | ✅ |
| 能力列表 | `CardData.abilities: AbilityData[]` | ✅ |
| Trigger | `CardData.trigger?: AbilityData` | ✅ |
| Raid 数据 | `CardData.raid?: RaidData` | ✅ (RQ-004) |
| 关键词（B5） | `CardData.keywords: string[]` | ✅ |
| **来源材料代码** | ❌ 缺失 | 🔴 |
| **属性标签** | ❌ 缺失 | 🔴 |

**缺失字段详情**：

```typescript
// Card_System.md §2.2 通用字段中定义，当前 types.ts 未包含：

// 1. sourceMaterial — 来源材料代码 (如 "HTR")
//    用途：卡组构筑验证（全部 50 张必须同来源）
//          Raid 目标匹配（按 Affinity 类型时需要）
//    影响：B1 加载卡牌时无法验证此字段 → B5 Raid 可能无法按 Affinity 匹配目标

// 2. affinities — 属性标签列表 (如 ["Hunter", "Protagonist"])
//    用途：Raid targetSpecifier.type === "Affinity" 时匹配
//          未来能力条件可能引用（如 "场上 Hunter 属性≥2"）
//    影响：B5 RaidSystem 按 Affinity 匹配目标时缺少数据来源

// 3. cardNumber — 完整卡牌编号 (如 "UA03BT/HTR-1-001")
//    用途：卡组构筑同名限制（相同 cardNumber ≤ 4）
//    MVP 可通过 cardId 替代，风险低

// 4. rarity — 稀有度
//    MVP 不需要，可推迟
```

### 2.2 AbilitySystem（Batch 3）— 支持度：⚠️ 基础满足，缺少运行时类型

| AbilitySystem 需求 | 当前类型 | 评估 |
|-------------------|---------|------|
| 能力数据模型 | `AbilityData` | ✅ |
| 条件数据 | `AbilityData.condition?: Record<string, any>` | ⚠️ 用 `any` 过于宽松 |
| 代价数据 | `AbilityData.costs: Array<{...}>` | ⚠️ `costType: string` 无编译检查 |
| 效果数据 | `AbilityData.effects: Array<{...}>` | ⚠️ `effectType: string` 无编译检查 |
| **能力实例（队列中）** | ❌ 缺失 | 🟡 B3 添加 |
| **能力上下文** | ❌ 缺失 | 🟡 B3 添加 |
| **目标描述符** | ❌ 缺失 | 🟡 B3 添加 |
| **已应用效果** | ❌ 缺失 | 🟡 B3 添加 |

**缺失类型详情**：

```typescript
// B3 需要新增以下类型（当前 types.ts 中不存在）：

// 1. AbilityInstance — 队列中的能力
//    需要：instanceId, abilityData, sourceCardInstanceId, 
//          sourcePlayerId, targetSelections, isTrigger

// 2. AbilityContext — 能力结算上下文
//    需要：gameState, sourceCard, sourcePlayer, targetSelections, event

// 3. TargetDescriptor — 目标选择描述符
//    需要：targetType, scope, location, filter, count, chooser

// 4. AppliedEffect — 已应用的效果追踪
//    需要：effectId, sourceCardId, sourceAbilityId, effectType, 
//          params, duration, turnsRemaining
```

> **评估**：这些类型不在 B0 定义是 **正确的设计决策**。B0-B1 不需要它们。应该在各 Batch 需要时增量添加。

### 2.3 BattleSystem（Batch 4）— 支持度：⚠️ 入口已预留，细节待补充

| BattleSystem 需求 | 当前类型 | 评估 |
|------------------|---------|------|
| 战斗状态入口 | `GameState.battleState: null` | 🔴 当前是字面量 `null`，B4 需改为 `BattleState \| null` |
| **BattleState 接口** | ❌ 缺失 | 🟡 B4 添加 |
| **BattleStep 枚举** | ❌ 缺失 | 🟡 B4 添加 |
| 攻击宣言事件 | `GameEventType: 'AttackDeclared'` | ✅ |
| 阻挡宣言事件 | `GameEventType: 'BlockDeclared'` | ✅ |
| 战斗结算事件 | `GameEventType: 'BattleResolved' \| 'BattleWon' \| 'BattleLost'` | ✅ |

**当前 `battleState: null` 的问题**：

```typescript
// 当前定义：
interface GameState {
  battleState: null;  // 字面量 null 类型 — 永远不能赋其他值
}

// B4 需要改为：
interface GameState {
  battleState: BattleState | null;
}

// 这是一个 BREAKING CHANGE。B4 时必须修改此字段类型。
// 但 B0-B3 期间 battleState 始终为 null，当前类型是正确的。
```

### 2.4 RaidSystem（Batch 5）— 支持度：✅ 基本满足

| RaidSystem 需求 | 当前类型 | 评估 |
|----------------|---------|------|
| Raid 数据模型 | `RaidData` | ✅ targetSpecifier + raidAbilities |
| 目标匹配（Name） | `RaidData.targetSpecifier.type: 'Name'` → 比对 cardName | ✅ |
| 目标匹配（Affinity） | `RaidData.targetSpecifier.type: 'Affinity'` → 比对 affinities | ⚠️ 依赖 CardData.affinities（见 2.1） |
| 堆叠状态 | `CardOnField.raidedBy` / `raiding` | ✅ |
| 能力分离（RQ-004） | `RaidData.raidAbilities` 与 `CardData.abilities` 分离 | ✅ |

---

## 三、类型设计问题

### 🔴 问题 1：CardData 缺少 sourceMaterial 和 affinities 字段

**严重程度**：中 — 影响 B5 Raid 按 Affinity 匹配目标，影响卡组构筑验证。

**当前**：
```typescript
interface CardData {
  cardId: string;
  cardName: string;
  // ... 无 sourceMaterial, affinities
}
```

**建议**（B1 时补充）：
```typescript
interface CardData {
  // ...existing fields...
  sourceMaterial: string;     // 来源材料代码，如 "HTR"
  affinities: string[];       // 属性标签，如 ["Hunter", "Protagonist"]
}
```

**如果不加会怎样**：
- B1-B4：无影响。8 张测试卡可以不用这两个字段。
- B5：RaidSystem 需要按 Affinity 匹配目标时会失败。需要回填 B1 的卡牌 JSON + 修改 CardData。

**建议处理时机**：**B1 即添加**。这两个字段是卡牌数据的固有属性，B1 写测试卡 JSON 时就填入，比 B5 再回填成本低。

---

### 🟡 问题 2：CardInZone 缺少 position 字段

**严重程度**：低 — 影响区域内的顺序控制（卡组顶/底、手牌顺序），但不影响核心规则。

**当前**：
```typescript
interface CardInZone {
  cardId: string;
  instanceId: string;
  ownerId: string;
  faceUp: boolean;
  // 无 position
}
```

**Architecture.md §3.3 原文**：
```
CardInZone {
  cardId, instanceId, ownerId, faceUp,
  position: number  // 在区域内的位置（0-based）
}
```

**影响**：
- 卡组：抽牌总是从"顶"抽。用数组索引隐式表示位置（index 0 = 顶），`position` 字段冗余。
- 手牌：玩家可能关心手牌顺序，但 MVP 可以不追踪。
- 生命区：攻击方"选择"生命卡时，位置可辅助 display。

**建议**：**不添加**。用数组索引隐式表示位置即可。Architecture.md 的 `position` 字段是为 UI 层准备的（拖拽排序），MVP 不需要。

---

### 🟡 问题 3：CardOnField 用于 AP 卡造成字段语义不匹配

**严重程度**：低 — 不影响功能，仅语义不完美。

**当前**：
```typescript
interface PlayerState {
  apArea: CardOnField[];  // AP 卡有 currentBP, raidedBy, raiding
}
```

**问题**：AP 卡没有 BP、不能被 Raid、不会在战斗中使用。`CardOnField` 的 `currentBP`、`raidedBy`、`raiding` 对 AP 卡无意义。

**替代方案**（不推荐 MVP 时期改）：
```typescript
// 方案 A: 新建 APCardInstance
interface APCardInstance extends CardInZone {
  state: FieldState;
}

// 方案 B: 保持现状，AP 卡忽略无关字段
```

**建议**：**保持现状**。为 AP 卡新建类型收益极小（省 3 个 unused 字段），但增加类型复杂度。AP 卡相关代码忽略 `currentBP` 即可。

---

### 🟡 问题 4：缺少 StateChange 类型

**严重程度**：中 — B1 GameState.applyChanges() **立刻**需要。

**当前 types.ts**：未定义 `StateChange`。

**B1 需要**：
```typescript
type StateChange =
  | { type: 'MOVE_CARD'; instanceId: string; from: Zone; to: Zone; playerId: string }
  | { type: 'SET_FIELD_STATE'; instanceId: string; state: FieldState }
  | { type: 'UPDATE_BP'; instanceId: string; bpDelta: number }
  | { type: 'ADJUST_AP'; playerId: string; count: number }
  | { type: 'DRAW_CARD'; playerId: string; count: number }
  | { type: 'SHUFFLE_DECK'; playerId: string };
```

**建议**：**B1 开发时添加**。这是 B1 GameState 的硬依赖，没有它 GameState.applyChanges() 无法定义。但它是 B0 不应该提前设计的典型例子 — B0 不需要知道具体的状态变更类型。

---

### 🟢 问题 5：字符串类型别名 vs 枚举的选择

**严重程度**：信息 — 这是设计选择，不是问题。

**当前**：所有分类字段使用 `type X = 'a' | 'b' | 'c'`（字符串字面量联合），而非 TypeScript `enum`。

**对比**：

| 维度 | `type` (字符串联合) | `enum` |
|------|-------------------|--------|
| 运行时值 | 直接使用字符串 `'Character'` | 使用 `CardType.CHARACTER` |
| JSON 互操作 | ✅ 直接序列化 | ⚠️ 需要转换 |
| 迭代/遍历 | ❌ 无运行时列表 | ✅ `Object.values()` |
| 代码补全 | ✅ 编辑器提示 | ✅ 编辑器提示 |

**当前项目的选择理由**：
- 卡牌数据来自 JSON 文件，字符串联合类型直接兼容 JSON 反序列化
- 不需要 `Object.values(CardType)` 遍历（卡牌类型是固定的 4 种）

**建议**：**保持字符串联合类型**。对于数据驱动的 TCG 引擎，JSON 互操作性的优先级高于枚举的便利性。

---

### 🔵 问题 6：AbilityData 中 string 类型字段的宽松性

**严重程度**：信息 — B0 设计决策，B3 时需关注。

**当前**：
```typescript
interface AbilityData {
  timing: string;     // 而非 AbilityTiming 枚举
  costs: Array<{ costType: string; ... }>;
  effects: Array<{ effectType: string; ... }>;
}
```

**这是 DEVELOPMENT_BATCH_PLAN.md 的**明确设计决策：
> "AbilityTiming / EffectType / ConditionType / CostType 等枚举不在 B0 定义。它们在使用 string 宽松类型，在需要严格枚举的 Batch（B3+）中再收紧。"

**B3 时的影响**：
- `TriggerDetector.matchTiming()` 需要用 `if (timing === 'WhenPlayed')` 做字符串比较
- 拼写错误（如 `'WhenPlayed'` 写成 `'WhenPlay'`）只在运行时暴露，无法编译期捕获
- **缓解**：B1 的卡牌 JSON 加载时有 CardSystem.validateCard() 做运行时验证

**建议**：B3 实现 AbilitySystem 时，将 `timing` / `costType` / `effectType` 收紧为联合类型：
```typescript
type AbilityTiming = 'WhenPlayed' | 'ActivateMain' | 'WhenAttacking' | ...;
type CostType = 'SwitchToResting' | 'PayAp' | ...;
type EffectType = 'DrawCard' | 'BpBuff' | ...;
```
不需要改为 enum — 字符串联合类型即可获得编译期检查。

---

## 四、总结

### 4.1 审查结论

**当前 types.ts 可以支撑 Batch 1 开发。** 不存在阻塞性类型缺陷。

### 4.2 待处理事项

| # | 事项 | 严重程度 | 建议处理时机 | 阻塞什么 |
|---|------|---------|-------------|---------|
| 1 | CardData 缺少 `sourceMaterial` + `affinities` | 🔴 中 | **B1 即添加** | B5 Raid Affinity 匹配 |
| 2 | 缺少 `StateChange` 类型 | 🟡 中 | B1 开发时添加 | B1 GameState.applyChanges() |
| 3 | `GameState.battleState: null` 需在 B4 改为 `BattleState \| null` | 🟡 中 | B4 | B4 BattleSystem |
| 4 | 缺少 `AbilityInstance` / `AbilityContext` / `TargetDescriptor` / `AppliedEffect` | 🟡 中 | B3 | B3 AbilitySystem |
| 5 | `AbilityData` 中使用 `string` 而非联合类型 | 🟢 低 | B3（收紧类型） | 仅运行时安全性 |
| 6 | `CardInZone` 缺少 `position` 字段 | 🟢 低 | 不需要 | 无阻塞 |
| 7 | AP 卡复用 `CardOnField` 语义不完全匹配 | 🟢 低 | 不需要 | 无阻塞 |

### 4.3 逐 Batch 类型补充路线图

```
Batch 0 (当前): ✅ 核心类型就绪
                 ├── CardData / AbilityData / RaidData
                 ├── CardInZone / CardOnField
                 ├── PlayerState / GameState
                 ├── GameEvent / ActionRequest / ActionResult
                 └── CardRegistry

Batch 1 补充:   + CardData.sourceMaterial (🔴 建议)
                 + CardData.affinities (🔴 建议)
                 + StateChange 联合类型 (🟡 必须)

Batch 2 补充:   (无新类型需求 — TurnManager/Energy/Movement 操作现有类型)

Batch 3 补充:   + AbilityInstance (🟡 必须)
                 + AbilityContext (🟡 必须)
                 + TargetDescriptor (🟡 必须)
                 + AppliedEffect (🟡 必须)
                 + 收紧 timing/costType/effectType 为联合类型 (🟢 建议)

Batch 4 补充:   + BattleState (🟡 必须)
                 + BattleStep (🟡 必须)
                 + GameState.battleState 改为 BattleState | null (🟡 必须)
                 + DamageResult / TriggerResult

Batch 5 补充:   + 关键词相关（如需新类型）
                 + Raid 结算相关

Batch 6 补充:   + GameConfig (GameEngine 初始化参数)
                 + GameResult (endGame 返回值)
```

---

> **关联文档**：
> - `src/core/types.ts` — 审查对象
> - `Architecture.md` §3 — 类型设计参考
> - `Card_System.md` §2 — 卡牌数据字段规范
> - `DEVELOPMENT_BATCH_PLAN.md` — Batch 0 范围定义
