# Union Arena 卡牌系统设计文档

> 本文档定义 Union Arena 的卡牌类型、卡牌数据结构、能量系统与卡牌效果系统的设计方案。
> 设计目标：建立**完全数据驱动**的卡牌系统，不为任何单张卡牌写硬编码逻辑。

---

## 一、卡牌类型总览

### 1.1 四种卡牌类型

```
┌───────────────────────────────────────────────────────────┐
│                    CARD TYPE HIERARCHY                     │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌──────┐ │
│  │  Character  │  │    Site     │  │  Event   │  │  AP  │ │
│  │   (角色卡)  │  │  (场地卡)   │  │ (事件卡) │  │(AP卡)│ │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  └──┬───┘ │
│         │                │              │           │     │
│  • 攻击/阻挡      • 支援效果     • 一次性能力    • 支付AP │
│  • 放置前线/能量线 • 仅能量线     • 结算后Sideline • 无能力│
│  • 有BP值         • 无BP值       • 无BP值        • 固定3张│
│  • 有能量生成     • 有能量生成   • 无能量生成             │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 1.2 卡牌类型差异矩阵

| 属性 | Character | Site | Event | AP |
|------|-----------|------|-------|-----|
| 可放置区域 | 前线/能量线 | 仅能量线 | 不放置（直接结算） | AP区 |
| BP值 | ✅ | ❌ | ❌ | ❌ |
| 能量生成 | ✅ | ✅ | ❌ | ❌ |
| 攻击 | ✅ | ❌ | ❌ | ❌ |
| 阻挡 | ✅ | ❌ | ❌ | ❌ |
| Raid | ✅ (部分) | ❌ | ❌ | ❌ |
| Abilities | ✅ | ✅ | ✅ | ❌ |
| Trigger | ✅ | ✅ | ✅ | ❌ |
| 打出后状态 | Resting | Resting | 进Sideline | Active |
| 容量限制 | 前线4/能量线4 | 能量线4 | 无 | 3张 |

---

## 二、卡牌数据结构设计

### 2.1 设计原则

1. **JSON序列化**：所有卡牌数据存储在JSON格式中
2. **字段完整性**：每张卡牌包含规则所需的全部信息
3. **类型区分**：通过 `cardType` 字段区分卡牌类型，不同类型有不同字段集
4. **可扩展性**：新增卡包只需添加JSON数据，无需修改引擎代码
5. **能力数据化**：能力用结构化数据表示，而非自由文本

### 2.2 通用字段（所有卡牌共有）

```json
{
  "cardId": "唯一标识符，如 HTR-1-001",
  "cardNumber": "卡牌编号 (如 UA03BT/HTR-1-001)",
  "cardName": "卡牌名称 (多语言)",
  "cardType": "Character | Site | Event | AP",
  "sourceMaterial": "来源材料代码 (如 HTR)",
  "rarity": "稀有度 (C/U/R/SR 等)",
  "requiredEnergy": {
    "color": "颜色标识 (如 白/红/蓝/绿/紫/黄)",
    "amount": "需要的最小能量数量 (数字)"
  },
  "apCost": "AP消耗量 (数字，AP卡为0)",
  "affinities": ["属性标签列表 (如 ['Hunter', 'Protagonist'])"],
  "abilities": [],
  "trigger": null
}
```

### 2.3 Character Card（角色卡）专属字段

```json
{
  "_extends": "通用字段",
  "cardType": "Character",
  "bp": {
    "base": "基础BP值 (数字)",
    "hasPlus": "是否有 + 标记 (boolean，表示能力可增加BP)"
  },
  "energyGeneration": [
    {
      "color": "能量颜色",
      "amount": "基础生成数量 (通常为1)",
      "hasPlus": "是否有 + 标记 (boolean)"
      // RQ-005 确认：hasPlus = true 表示该卡自身拥有可增加能量生成量的能力。
      // 引擎需检查该卡的 abilities 中是否有修改能量生成的效果。
      // 加号不是纯粹装饰 — 它表示能量生成值可能因该卡自身能力而动态变化。
    }
  ],
  "raid": {
    "hasRaid": true,
    "targetSpecifier": {
      "type": "Name | Affinity",
      "value": "目标名称或属性名"
    },
    // RQ-004 确认：Raid 描述框内的 ALL 内容仅在 Raid 打出时生效。
    // 普通打出时，raidAbilities 中的全部能力不注册、不生效。
    // raidAbilities 必须与 abilities[] 分开存储，引擎根据打出方式决定注册哪组。
    "raidAbilities": [
      { "effectType": "SWITCH_TO_ACTIVE", "target": "SELF" },
      { "effectType": "MOVE_TO_FRONT_LINE", "target": "SELF" }
    ]
  },
  "keywords": ["Step", "Snipe", "Double Attack", "..."],
  "abilities": [],
  "trigger": {}
}
```

### 2.4 Site Card（场地卡）专属字段

```json
{
  "_extends": "通用字段",
  "cardType": "Site",
  "energyGeneration": [
    {
      "color": "能量颜色",
      "amount": "基础生成数量",
      "hasPlus": "是否有 + 标记 (boolean)"
    }
  ],
  "keywords": [],
  "abilities": [],
  "trigger": {}
}
```

### 2.5 Event Card（事件卡）专属字段

```json
{
  "_extends": "通用字段",
  "cardType": "Event",
  "keywords": [],
  "abilities": [],
  "trigger": {}
}
```

### 2.6 AP Card（AP卡）专属字段

```json
{
  "cardType": "AP",
  "cardId": "AP-001",
  "cardName": "AP Card"
}
```

> AP卡结构最简单，基本无数据字段。引擎内可直接硬编码生成3张。

---

## 三、能量系统设计

### 3.1 能量生成

```
能量线 (Energy Line)
    │
    ├─ 角色卡 A: { color: "白", amount: 1 }    ─┐
    ├─ 角色卡 B: { color: "白", amount: 1 }     ├─ 总能量计算
    ├─ Site卡 C:  { color: "红", amount: 1 }    │
    ├─ 角色卡 D: { color: "白", amount: 1 }    ─┘
    │
    ▼
  总能量: { "白": 3, "红": 1 }
```

### 3.2 能量需求匹配规则

```
使用卡牌时的能量检查：

  1. 统计能量线上所有卡的能量生成（按颜色汇总）
  2. 比较所需能量颜色和数量
  3. 必须满足: 总生成量(目标颜色) ≥ requiredEnergy.amount
  4. 颜色由 requiredEnergy.color 决定（卡牌的颜色即需求颜色）

示例：
  卡牌需求: { color: "白", amount: 3 }
  能量线提供: { "白": 3, "红": 1 }
  结果: ✅ 满足 (白3 ≥ 白3)
```

### 3.3 能量生成的特殊规则

```
• 前线上卡牌的能量生成图标被忽略（不参与总能量计算）
• 有 + 标记的能量生成表示可能因能力效果而增加
• 能量线的容量为4张卡
• 默认情况下，每张卡生成1个对应颜色的能量
```

### 3.4 能量计算的引擎要求

```
Engine 需追踪:
  ├─ 能量线上每张卡的能量生成数据
  ├─ 因能力效果带来的能量生成增减
  ├─ 实时汇总各颜色能量总量
  └─ 能量检查接口: canAfford(card) → boolean
```

---

## 四、能力系统设计（核心）

### 4.1 能力系统的核心挑战

Union Arena 的能力系统是整个规则引擎中最复杂的部分。能力由**自然语言**书写，需要被解析为**结构化数据**，再由引擎**解释执行**。

### 4.2 能力的结构化拆分

将每条能力拆分为四个正交维度：

```
┌──────────────────────────────────────────────────────────┐
│               ABILITY STRUCTURE                           │
│                                                          │
│   Ability = Timing + Condition + Cost + Effect           │
│                                                          │
│   Timing   : 这条能力在什么时机触发/发动？                   │
│   Condition: 发动前需要满足什么条件？(可选)                  │
│   Cost     : 发动需要支付什么代价？(可选,可多个)             │
│   Effect   : 发动后产生什么效果？(可多个)                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.3 时机系统 (Timing)

#### 4.3.1 自动触发时机

| 时机标识 | 触发条件 | 说明 |
|---------|---------|------|
| `WHEN_PLAYED` | 卡牌以任意方式进入场上时 | 从手牌打出 / Raid打出 / 被效果"play"入场 均触发（RQ-001 确认：最宽泛解释） |
| `WHEN_SIDELINED` | 卡牌被Sidelined时 | 战斗中战败/BP归零/效果Sideline |
| `WHEN_ATTACKING` | 卡牌攻击宣言时 | 在阻挡宣言之前结算 |
| `WHEN_BLOCKING` | 卡牌阻挡宣言时 | 在战斗结算之前结算 |
| `WHEN_BATTLE_WINS` | 攻击战获胜时 | Impact等能力 |
| `WHEN_BATTLE_LOSES` | 攻击战败时 | |
| `WHEN_NOT_BLOCKED` | 攻击未被阻挡时 | |
| `START_OF_TURN` | 己方回合开始时 | |
| `END_OF_TURN` | 己方回合结束时 | |
| `START_OF_ATTACK_PHASE` | 攻击阶段开始时 | |
| `END_OF_BATTLE` | 单次战斗结束时 | |

#### 4.3.2 手动发动时机

| 时机标识 | 发动方式 | 说明 |
|---------|---------|------|
| `ACTIVATE_MAIN` | 主阶段手动发动 | 最常见的主动能力 |
| `TRIGGER` | 生命区翻开时可选发动 | Trigger能力 |

#### 4.3.3 持续性时机

| 时机标识 | 有效范围 | 说明 |
|---------|---------|------|
| `DURING_YOUR_TURN` | 己方回合持续 | 被动效果 |
| `DURING_OPPONENT_TURN` | 对方回合持续 | 被动效果 |
| `DURING_BATTLE` | 本次战斗持续 | 战斗中临时效果 |

### 4.4 条件系统 (Condition)

```
条件是可选的筛选器，在时机满足后进一步判断是否可发动。

条件类型：
  ┌────────────────────────────────────────────┐
  │ IF_ON_FRONT_LINE     : 该卡在前线时        │
  │ IF_ON_ENERGY_LINE    : 该卡在能量线时       │
  │ IF_ACTIVE            : 该卡为Active状态时   │
  │ IF_OPPONENT_HAS_CHARACTER : 对方前线有角色时 │
  │ IF_HAND_NOT_EMPTY    : 手牌不为空时         │
  │ IF_LIFE_UNDER_N      : 生命值低于N时        │
  │ IF_AFFINITY_COUNT_N  : 场上某属性数量≥N时    │
  │ ... (可扩展)                                │
  └────────────────────────────────────────────┘
```

### 4.5 代价系统 (Cost)

```
代价是发动能力时必须支付的东西。一个能力可有多个代价（必须全部支付）。

代价类型：
  ┌────────────────────────────────────────────┐
  │ SWITCH_TO_RESTING    : 将该卡 Active→Resting │
  │ PAY_AP(n)            : 支付n点AP            │
  │ SIDELINE_THIS_CARD   : 将该卡Sidelined      │
  │ DISCARD_FROM_HAND(n) : 从手牌弃n张到Sideline │
  │ SIDELINE_FROM_HAND(n): 从手牌Sideline n张   │
  │ ... (可扩展)                                │
  └────────────────────────────────────────────┘

代价支付规则：
  ├─ 所有代价必须能完整支付才能发动能力
  ├─ 支付是原子性的（全部支付或全部不支付）
  └─ 先支付代价 → 后结算效果
```

### 4.6 效果系统 (Effect)

```
效果是能力结算后实际产生的游戏状态变更。

效果类型分类：
```

#### 4.6.1 卡牌移动类

| 效果 | 参数 | 说明 |
|------|------|------|
| `DRAW_CARD` | count, player | 抽N张卡 |
| `SIDELINE_CHARACTER` | target | 将目标角色Sidelined |
| `RETURN_TO_HAND` | target | 将目标返回手牌 |
| `PLACE_INTO_REMOVAL` | target | 将目标放入移除区 |
| `MOVE_TO_FRONT_LINE` | target | 将角色移至前线 |
| `MOVE_TO_ENERGY_LINE` | target | 将角色移至能量线 |

#### 4.6.2 BP修改类

| 效果 | 参数 | 说明 |
|------|------|------|
| `BP_BUFF` | target, amount, duration | BP增加 (如 +2000) |
| `BP_DEBUFF` | target, amount, duration | BP减少 (如 -1000) |
| `BP_SET` | target, amount, duration | BP设置为固定值 |

#### 4.6.3 状态修改类

| 效果 | 参数 | 说明 |
|------|------|------|
| `SWITCH_TO_ACTIVE` | target | 切换为Active |
| `SWITCH_TO_RESTING` | target | 切换为Resting |
| `PREVENT_ACTIVE_SWITCH` | target, duration | 阻止切换为Active |
| `PREVENT_RESTING_SWITCH` | target, duration | 阻止切换为Resting |

#### 4.6.4 关键词授予类

| 效果 | 参数 | 说明 |
|------|------|------|
| `GAIN_KEYWORD` | target, keyword, duration | 获得关键词 |
| `LOSE_KEYWORD` | target, keyword, duration | 失去关键词 |

#### 4.6.5 伤害类

| 效果 | 参数 | 说明 |
|------|------|------|
| `DEAL_DAMAGE` | targetPlayer, amount | 造成直接伤害 |
| `HEAL_DAMAGE` | targetPlayer, amount | 恢复生命（如有此机制） |

#### 4.6.6 信息操作类

| 效果 | 参数 | 说明 |
|------|------|------|
| `SEARCH_DECK` | filter, count, destination | 从卡组搜索卡牌 |
| `REVEAL_HAND` | targetPlayer | 展示手牌 |
| `LOOK_AT_LIFE` | targetPlayer | 查看生命区 |

### 4.7 目标选择系统

```
效果需要选择目标时，使用目标描述符：

{
  "targetType": "CHARACTER | SITE | CARD | PLAYER",
  "scope": "SELF | OPPONENT | ANY",
  "location": "FRONT_LINE | ENERGY_LINE | FIELD | HAND | LIFE | SIDELINE | DECK",
  "filter": {
    "bpMin": null,
    "bpMax": null,
    "color": null,
    "affinity": null,
    "state": "ACTIVE | RESTING | ANY",
    "hasKeyword": null
  },
  "count": "数量 (数字 或 'upTo:N')",
  "chooser": "CONTROLLER | OPPONENT | OWNER"
}
```

### 4.8 持续时间 (Duration)

```
效果持续时间：
  ├─ INSTANT          : 立即生效，无持续
  ├─ UNTIL_END_OF_TURN: 本回合结束时清除
  ├─ UNTIL_START_OF_NEXT_TURN: 下回合开始时清除
  ├─ DURING_BATTLE    : 本次战斗结束时清除
  ├─ UNTIL_END_OF_NEXT_ATTACK_PHASE: 持续到下次攻击阶段结束
  ├─ PERMANENT        : 只要卡在场上就持续
  └─ WHILE_ON_FIELD   : 卡在场期间持续
```

---

## 五、能力表示示例

### 5.1 示例一：简单 When Played 能力

> 原始文本："When Played: Draw 1 card."

```json
{
  "abilityId": "ABL_001",
  "timing": "WHEN_PLAYED",
  "condition": null,
  "costs": [],
  "effects": [
    {
      "effectType": "DRAW_CARD",
      "params": {
        "count": 1,
        "player": "SELF"
      }
    }
  ],
  "isOncePerTurn": false,
  "isOptional": false
}
```

### 5.2 示例二：Activate: Main 能力（含代价）

> 原始文本："Activate: Main Switch to Resting Pay 1 AP: Choose up to one character on your opponent's front line and switch it to resting."

```json
{
  "abilityId": "ABL_002",
  "timing": "ACTIVATE_MAIN",
  "condition": null,
  "costs": [
    { "costType": "SWITCH_TO_RESTING" },
    { "costType": "PAY_AP", "params": { "amount": 1 } }
  ],
  "effects": [
    {
      "effectType": "SWITCH_TO_RESTING",
      "target": {
        "targetType": "CHARACTER",
        "scope": "OPPONENT",
        "location": "FRONT_LINE",
        "count": "upTo:1",
        "chooser": "CONTROLLER"
      }
    }
  ],
  "isOncePerTurn": false,
  "isOptional": true
}
```

### 5.3 示例三：When Attacking BP Buff

> 原始文本："When Attacking: This character gains BP +2000 for the duration of this battle."

```json
{
  "abilityId": "ABL_003",
  "timing": "WHEN_ATTACKING",
  "condition": null,
  "costs": [],
  "effects": [
    {
      "effectType": "BP_BUFF",
      "target": {
        "targetType": "CHARACTER",
        "scope": "SELF",
        "location": "FIELD"
      },
      "params": {
        "amount": 2000,
        "duration": "DURING_BATTLE"
      }
    }
  ],
  "isOncePerTurn": false,
  "isOptional": false
}
```

### 5.4 示例四：含条件的能力

> 原始文本："If on the Front Line: This character gains Impact 1."

```json
{
  "abilityId": "ABL_004",
  "timing": "DURING_YOUR_TURN",
  "condition": {
    "conditionType": "IF_ON_FRONT_LINE"
  },
  "costs": [],
  "effects": [
    {
      "effectType": "GAIN_KEYWORD",
      "params": {
        "keyword": "Impact 1",
        "duration": "WHILE_ON_FIELD"
      }
    }
  ],
  "isOncePerTurn": false,
  "isOptional": false
}
```

### 5.5 示例五：Trigger 能力

> 原始文本：Trigger: "Draw 1 card."

```json
{
  "trigger": {
    "abilityId": "TRG_001",
    "timing": "TRIGGER",
    "condition": null,
    "costs": [],
    "effects": [
      {
        "effectType": "DRAW_CARD",
        "params": {
          "count": 1,
          "player": "SELF"
        }
      }
    ],
    "isOptional": true
  }
}
```

---

## 六、Raid 系统设计

### 6.1 Raid 数据结构

**RQ-004 确认**：Raid 描述框（卡牌上 Raid 符号右侧的特殊背景区域）内的**所有**文本内容，仅在以 Raid 方式打出时生效。普通打出时，整个框内内容完全忽略。因此，卡牌数据中 Raid 专属能力必须与普通能力**分开存储**。

```json
{
  "raid": {
    "hasRaid": true,
    "targetSpecifier": {
      "type": "Name",
      "value": "Gon Freecss"
    },
    // raidAbilities: 仅在 Raid 打出时注册和生效
    // 普通打出时此数组中的所有能力被完全忽略
    "raidAbilities": [
      { "effectType": "SWITCH_TO_ACTIVE", "target": "SELF" },
      { "effectType": "MOVE_TO_FRONT_LINE", "target": "SELF" }
    ]
  }
}
```

> **引擎行为**：打出卡牌时，根据打出方式（普通 vs Raid）决定注册哪些能力：
> - 普通打出：仅注册 `abilities[]` 中的能力
> - Raid 打出：注册 `abilities[]` + `raid.raidAbilities[]` 中的全部能力

### 6.2 Raid 结算流程

```
Raid 结算顺序：
  1. 验证Raid目标在场上存在
  2. 验证能量需求和AP
  3. 支付AP → 将新卡堆叠在目标上
  4. 底部卡的能力失效
  5. 如果底部卡为Resting → 切换为Active
  6. 如果在能量线上 → 可移动到前线
  7. 触发新卡的 When Played 能力
```

### 6.3 Raid 卡堆叠状态管理

```
Raid卡堆叠 (Stacked Cards):
  ┌────────────────────┐
  │   顶层卡 (活动)     │ ← 名字/BP/能力/颜色均以此卡为准
  ├────────────────────┤
  │   底层卡 (不活动)   │ ← 能力失效，仅保留实体
  └────────────────────┘

规则：
  ├─ 只有顶层卡参与游戏判定
  ├─ 底层卡的能力不生效
  ├─ 当Raid卡离开场上时：仅顶卡去目标区域，底卡→Sideline
  └─ 底卡不算被"Sidelined"
```

---

## 七、关键词能力系统

### 7.1 关键词作为能力简写

```
关键词是预定义的复合能力，引擎在加载卡牌数据时可展开：

  Step        → 移动阶段可前线→能量线移动
  Snipe       → 攻击时可选择对方前线角色为目标 + 不可阻挡
  Double Attack → 首次攻击后切换为Active
  Double Block  → 首次阻挡后切换为Active
  Impact 1    → 攻击获胜时造成1点额外伤害
  Impact +1   → Impact伤害+1
  Damage 2    → 直接攻击时造成2点伤害
  Damage +1   → 直接攻击伤害+1
  Nullify Impact → 战斗中对方失去Impact
```

### 7.2 关键词展开机制

```
引擎处理关键词的方式：

方案A（推荐）：预展开
  ├─ 卡牌加载时将关键词展开为等效的能力条目
  ├─ 引擎无需区分"来自关键词的效果"和"来自能力文本的效果"
  └─ 确保效果结算逻辑统一

方案B：能力层叠加
  ├─ 引擎内建关键词处理器
  ├─ 关键词独立于能力系统
  └─ 增加复杂度，不推荐
```

### 7.3 关键词展开示例

```
"Snipe" 展开为：

能力1（攻击目标修改）:
  timing: WHEN_ATTACKING
  effect: ALLOW_TARGET_CHARACTER + PREVENT_BLOCK

"Double Attack" 展开为：

能力1（攻击后恢复）:
  timing: END_OF_BATTLE (首次攻击)
  condition: IS_FIRST_ATTACK_THIS_TURN
  effect: SWITCH_TO_ACTIVE (自身)
  isOncePerTurn: true
```

---

## 八、卡牌效果DSL（领域特定语言）设计思路

### 8.1 为什么需要DSL

```
能力文本 → 结构化 JSON → 引擎执行

问题：
  - 纯JSON描述能力虽然精确但冗长
  - 手动编写JSON容易出错
  - 需要一种更易读的中间表示

解决方案：
  → 设计一种简单的效果DSL
  → 解析器将DSL转为JSON
  → 引擎只执行JSON
```

### 8.2 DSL 语法草案（参考）

```
能力DSL语法结构：

<Timing> [Condition] [Cost] : <EffectList>

示例：
  When Played : Draw 1
  Activate Main SwitchToResting PayAP(1) : Choose(upTo:1, OpponentFrontLine, Character) SwitchToResting
  When Attacking : Self BP +2000 DuringBattle
  IfOnFrontLine : Self GainKeyword(Impact 1) Permanent
  Trigger : Draw 1
```

### 8.3 DSL → JSON 管道

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│  卡牌数据库 (源)  │ ──→ │  DSL Parser  │ ──→ │  Ability JSON │ ──→ 引擎
│  (含DSL文本)     │     │  (构建时)    │     │  (运行时加载) │
└──────────────────┘     └──────────────┘     └──────────────┘
```

---

## 九、字段互斥与卡牌完整性规则

### 9.1 类型与字段约束

| 卡牌类型 | BP | 能量生成 | 可放前线 | 可放能量线 | 可攻击/阻挡 | Raid |
|---------|-----|---------|---------|-----------|------------|------|
| Character | ✅ 必填 | ✅ 可选 | ✅ | ✅ | ✅ | ✅ 可选 |
| Site | ❌ | ✅ 必填 | ❌ | ✅ | ❌ | ❌ |
| Event | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AP | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 9.2 数据验证规则

```
卡牌数据加载验证：
  ├─ cardId 格式: {SOURCE}-{SET}-{NUMBER} (如 HTR-1-001)
  ├─ requiredEnergy.color 必须为有效颜色
  ├─ bp.base > 0 (对于角色卡)
  ├─ apCost ≥ 0
  ├─ 同一CardNumber在卡组中 ≤ 4
  ├─ 能力中的 target location 必须有效
  └─ trigger 不能为 null（用空对象表示无trigger）
```

---

## 十、规则引擎卡牌模块接口设计要点

### 10.1 核心模块

```
CardRegistry:
  ├─ loadCard(cardJSON) → Card
  ├─ getCard(cardId) → Card
  └─ validateDeck(cardList) → ValidationResult

AbilityEngine:
  ├─ parseAbility(abilityJSON) → Ability
  ├─ checkCondition(ability, gameState) → boolean
  ├─ payCosts(ability, gameState) → boolean
  ├─ executeEffects(ability, gameState) → StateChanges
  └─ getTriggeredAbilities(event, gameState) → Ability[]

EnergyManager:
  ├─ calculateEnergy(playerId) → EnergyMap
  └─ canAfford(card, playerId) → boolean

RaidManager:
  ├─ canRaid(card, targetCharacter) → boolean
  ├─ performRaid(card, targetCharacter) → StateChanges
  └─ handleStackedCardLeaves(card, destination) → StateChanges

KeywordResolver:
  ├─ resolveKeywords(card) → Ability[]
  └─ expandKeyword(keyword) → Ability[]
```

### 10.2 数据加载流程

```
启动时：
  1. 加载所有卡牌JSON数据文件
  2. 验证每张卡牌数据完整性
  3. 解析能力DSL → 结构化JSON（或直接用结构化JSON）
  4. 展开所有关键词 → 等效力能力条目
  5. 注册到 CardRegistry
  6. 引擎可通过 cardId 查询任何卡牌的完整游戏数据
```

---

> **关联文档**：`Game_Design.md` — 游戏整体流程与回合结构  
> **关联文档**：`Battle_System.md` — 战斗系统详细设计  
> **原则文档**：`CLAUDE.md` — 项目开发原则（数据与逻辑分离、不为单卡写硬编码）
