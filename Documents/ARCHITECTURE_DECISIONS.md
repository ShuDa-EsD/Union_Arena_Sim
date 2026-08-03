---

## AD-011: BattleSystem 只负责战斗流程控制

**日期**：2026-08-04（Batch 4）
**状态**：✅ 已确定

### 决策

BattleSystem 的职责**严格限定为战斗流程控制**。它编排攻击阶段的生命周期，但不自行计算伤害或结算 Trigger。

### 职责

| 方法 | 职责 |
|------|------|
| `declareAttack` | Active验证 → Resting → Snipe检测 → WhenAttacking触发 → 进入BlockerDeclaration |
| `declareBlock` | Active验证 → Resting → Blocker设置 |
| `skipBlock` | 防御方选择不阻挡 → 进入Resolving |
| `resolveBattle` | BP比较(分支A/B) → **委托**DamageSystem.dealDamage → **委托**TriggerSystem.processTriggers |
| `endBattle` | Double Attack恢复 → 清除BattleState |

### 委托关系

```
BattleSystem.resolveBattle
  ├── 有阻挡 → BP比较 → Impact检查 → DamageSystem.dealDamage → TriggerSystem.processTriggers
  └── 无阻挡 → DamageSystem.dealDamage → TriggerSystem.processTriggers
```

### 不负责

- 伤害点数计算 → DamageSystem
- Trigger 检查/发动 → TriggerSystem
- WhenAttacking/WhenBlocking/Impact 能力结算 → AbilitySystem（通过 EventBus 触发）
- 胜负判定 → ActionSystem（战斗结束后检查生命区）

---

## AD-012: DamageSystem 只负责伤害计算

**日期**：2026-08-04（Batch 4）
**状态**：✅ 已确定

### 决策

DamageSystem 的职责**严格限定为伤害点数计算和生命卡选择**。它不处理 Trigger 也不修改生命卡以外的游戏状态。

### 职责

| 方法 | 职责 |
|------|------|
| `calculateDamage(modifiers)` | 基础1 + multiplier(Damage2) + bonus(Damage+1) |
| `dealDamage(state, targetId, amount, sourceId)` | 选择生命卡 → 生成 MOVE_CARD StateChange → 返回被翻开的卡牌列表 |
| `extractDamageModifiers(effects)` | 从能力效果列表中提取 damage modifier |

### 伤害公式

```
finalDamage = max(1, multiplier ?? base + bonus)
  base = 1
  multiplier = SetDamageMultiplier 效果值 (Damage 2 → 2)
  bonus = ModifyDamage 效果累加值 (Damage +1 → +1)
```

### ⚠️ 待确认：DamageModifier 优先级

当前实现：`multiplier` 和 `bonus` 是叠加关系（Damage 2 + Damage +1 = 3）。

需要规则确认：
- Damage 2 和 Damage +1 的交互是否正确？
- Damage 2 是否覆盖 Damage +1？
- 多个 Damage +1 是否叠加？

**当前处理**：multiplier 替换基础值，bonus 在 multiplier 基础上叠加。待规则确认后可能调整。

### 不负责

- 伤害应用后的 Trigger → TriggerSystem
- 战斗胜负判定 → BattleSystem
- 能力效果中的 DealDamage → AbilitySystem.EffectExecutor

---

## AD-013: TriggerSystem 负责生命卡 Trigger 检测与流程控制

**日期**：2026-08-04（Batch 4）
**状态**：✅ 已确定

### 决策

TriggerSystem 负责**Trigger 的检测和流程控制**，但 Trigger 能力的具体结算**委托给 AbilitySystem**。

### 职责

| 方法 | 职责 |
|------|------|
| `hasTrigger(card, getCardData)` | 检查卡牌是否有 Trigger 能力 |
| `processTriggers(state, lifeCards, playerId, getCardData)` | 逐张处理：检查→发动→Sideline |

### Trigger 处理流程

```
For each lifeCard:
  1. 检查 cardData.trigger 是否存在
  2. 有 Trigger → 创建 AbilityInstance(isTrigger=true)
     → AbilitySystem.resolveQueue → 结算能力效果
     → emit TriggerActivated
  3. 无 Trigger → 跳过
  4. 卡牌进入 Sideline（由 DamageSystem.dealDamage 的 MOVE_CARD 完成）
```

### 不负责

- Trigger 能力的效果执行 → AbilitySystem
- 生命卡翻开/移动 → DamageSystem
- BP比较/战斗 → BattleSystem

---

## AD-014: AbilitySystem 负责 Trigger 能力的效果结算

**日期**：2026-08-04（Batch 4）
**状态**：✅ 已确定

### 决策

Trigger 被检测到后，其能力的**效果结算完全由 AbilitySystem 处理**。TriggerSystem 只负责"是否发动"的流程判断，不执行效果。

### 实现细节

- Trigger 能力以 `AbilityInstance(isTrigger=true)` 传入 `AbilitySystem.resolveQueue`
- 结算流程与普通能力完全相同：条件复查 → 代价支付 → 效果执行
- Trigger 能力来源卡牌可能不在场上（在 Sideline/LifeArea），因此 AbilitySystem 新增 `findCardAnywhere` 方法

### 影响

- `AbilitySystem.findCardAnywhere` 搜索**所有区域**（而不仅是 frontLine/energyLine）
- Trigger 的 `sourcePlayerId` 是受伤害方（生命卡持有者），而非当前回合玩家
- 在 AbilityQueue 中，Trigger 能力按归属优先级排序（受伤害方可能不是当前回合玩家）

---

## AD-015: Trigger MVP 阶段自动发动

**日期**：2026-08-04（Batch 4）
**状态**：✅ 已确定（MVP 简化）

### 决策

MVP 阶段，Trigger 能力**自动发动**，不询问玩家选择。

### 当前行为

```typescript
// TriggerSystem.processTriggers (MVP)
if (cardData?.trigger) {
  // 自动发动，不询问玩家
  const instance = { ...abilityData: cardData.trigger, isTrigger: true };
  abilitySystem.resolveQueue(state, [instance], getCardData);
}
```

### 未来扩展

完整实现需要支持：
1. 防御方逐张选择是否发动 Trigger
2. 多 Trigger 时防御方选择结算顺序
3. 可能需要在 TriggerSystem 中增加"等待玩家决策"的回调/钩子

### 影响

- MVP 测试中所有 Trigger 会自动结算（无法测试"选择不发动"路径）
- 当从 MVP 升级到完整版时，需要修改 `processTriggers` 增加决策回调参数
- TriggerSystem 接口已预留 `isOptional` 标记（AbilityData.isOptional），但目前未使用

---

## AD-016: DamageModifier 优先级待规则确认

**日期**：2026-08-04（Batch 4）
**状态**：⏳ 待规则确认

### 问题

Damage 2（SetDamageMultiplier）和 Damage +1（ModifyDamage）同时存在时的交互。

### 当前实现（临时）

```
multiplier 替换基础值，bonus 在 multiplier 基础上叠加
例：Damage 2 + Damage +1 = 2 + 1 = 3
```

### 待确认

1. Damage 2 和 Damage +1 是否叠加？还是 Damage 2 覆盖 Damage +1？
2. 多个 Damage +1 是否叠加？
3. 是否有其他伤害修正来源需要考虑？

### 影响范围

- `DamageSystem.calculateDamage` 的计算逻辑
- 关键词展开时 Damage 2 / Damage +1 的能力定义

---

> **后续 Batch 待记录**：
> - RaidSystem 堆叠模型 (B5)
> - 关键词展开管道 (B5)