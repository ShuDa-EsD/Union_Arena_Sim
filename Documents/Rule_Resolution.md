# Union Arena — 规则疑点确认清单

> 创建日期：2026-08-03
> 状态：✅ 8/9 已确认，1 待查证
>
> 本文档汇总了在架构设计过程中发现的所有规则疑点。
> 每个疑点均标注了来源、影响范围、待确认内容和可能的答案选项。

---

## 使用说明

1. 每条规则疑点包含：编号、问题描述、规则来源、影响模块、可能的答案选项
2. 请在「**你的裁决**」下填写确认结果
3. 裁决后请将状态从 `⏳` 更新为 `✅`
4. 确认后的规则将被纳入 `rules_EnglishVer.md` 或相应的设计文档

---

## 确认进度

| 总数 | 已确认 | 待确认 |
|------|--------|--------|
| 9 | 8 | 1 (RQ-009) |

---

## 疑点清单

---

### RQ-001：When Played 的触发范围 — "plays the card" 的边界

**状态**：✅ 已确认（2026-08-03）— 裁决：C

**问题描述**：
规则手册 Game Terms 中写道：

> "When Played: Activates when you play the card onto your field. This ability also activates when the card performs Raid due to a trigger, or when an ability, either on the card or otherwise, plays the card onto the field, even during your opponent's turn."

需要确认：
- 「play the card」是否仅指从手牌打出？
- 从手牌以外（如卡组、Sideline）被效果"放入场上"是否算「play」？
- 从手牌被效果"放入场上"（如其他卡的 When Played 效果）是否也算「play」？

**规则来源**：`rules_EnglishVer.md` §Game Terms — When Played

**影响模块**：`AbilitySystem`（TriggerDetection）、`CardSystem`

**可能答案**：

| 选项 | 描述 | 
|------|------|
| A | "play" 严格 = 从手牌通过 Main Phase A 操作打出（最保守） |
| B | "play" = 从手牌以任意方式进入场上（包括被其他效果"play"） |
| C | "play" = 以任意方式从任意区域进入场上（最宽松） |
| D | 需要查阅官方 FAQ 或日文原版规则确认 |

**你的裁决**：

```
[  ] A    [  ] B    [ 正确 ] C    [  ] D    [  ] 其他：______

补充说明：
____________________________________________________________
____________________________________________________________
```

---

### RQ-002：入场角色是否有攻击限制？（召唤失调）

**状态**：✅ 已确认（2026-08-03）— 裁决：Other（见补充说明）

**问题描述**：
规则手册未提及本回合入场的角色是否可以立即攻击。
在 MTG 中此概念称为"召唤失调"（Summoning Sickness），但在 Union Arena 规则中未见等价描述。

需要确认：
- 本回合打出的角色是否可以在同一回合的 Attack Phase 攻击？
- Raid 后的角色（切换 Active + 可选移前线）是否可以立即攻击？
- 如果有限制，是否只限于攻击，还是也影响 Activate: Main 能力的使用？

**规则来源**：未在规则手册中找到

**影响模块**：`BattleSystem`、`RuleValidator`

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | 无限制 — 入场即可攻击（与规则手册一致：始终未提限制） |
| B | 有限制 — 本回合入场的角色不能攻击，但可以使用 Activate: Main 能力 |
| C | 有限制 — 本回合入场的角色不能攻击也不能使用 Switch to Resting 代价的能力 |
| D | Raid 入场无限制，普通打出有限制 |

**你的裁决**：

```
[  ] A    [  ] B    [  ] C    [  ] D    [  ] 其他：__角色可否攻击，取决于角色是否为休息“rest”状态，只要是rest状态，一律不能攻击，当回合打出的角色只能以rest状态被放置到能量线/前线，所以不能攻击，使用raid时，会把角色从raid状态转换为active状态，所以能攻击____

补充说明：
____________________________________________________________
____________________________________________________________
```

---

### RQ-003：Start Phase 持续性效果清除的顺序

**状态**：✅ 已确认（2026-08-03）— 裁决：A

**问题描述**：
规则手册 §Start Phase 写道：

> "Abilities that state they are active until the start of your next turn, and other similarly phrased abilities, become inactive."

但未说明：如果有多个效果同时到期清除，清除的顺序是什么？顺序是否重要？

需要确认：
- 多个到期效果是同时清除还是按某种顺序？
- 如果同时清除，清除后是否会产生「中间状态」影响彼此？
- 例如：效果A将卡X设为 Resting 直到下回合开始，效果B将卡X的 BP+2000 直到下回合开始 — 两者同时清除时是否有中间状态？

**规则来源**：`rules_EnglishVer.md` §Start Phase

**影响模块**：`DurationManager`、`TurnManager`

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | 同时清除 — 所有到期效果在同一时刻失效，不存在中间状态 |
| B | 按注册顺序逐一清除（FIFO） |
| C | 按某种优先级清除（如：先清除状态效果，后清除BP效果） |
| D | 执行顺序无关紧要，因为清除之间不触发其他能力 |

**你的裁决**：

```
[ 正确 ] A    [  ] B    [  ] C    [  ] D    [  ] 其他：______

补充说明：
____________________________________________________________
____________________________________________________________
```

---

### RQ-004：Raid 描述内能力在普通打出时的失效范围

**状态**：✅ 已确认（2026-08-03）— 裁决：A

**问题描述**：
规则手册 §Raid 写道：

> "Cards with Raid may also be played normally. However, any abilities contained within the Raid description are lost."

需要确认：
- 卡牌上 Raid 描述区域（通常以特殊背景/方框标记）内的文本，在普通打出时是完全不生效，还是仅 Raid 专属部分不生效？
- 具体来说，Raid 描述内的「Switch to active. May move to the front line.」很清楚是 Raid 专属的 — 但如果 Raid 描述框内还包含一条 When Played 能力呢？那条 When Played 在普通打出时生效吗？
- "abilities contained within the Raid description" — 指的是 Raid 符号右侧的描述文本内的所有能力？

**规则来源**：`rules_EnglishVer.md` §Raid

**影响模块**：`RaidSystem`、`CardSystem`（卡牌数据建模）

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | Raid 描述框内的所有文本仅在 Raid 打出时生效，普通打出时整个框内内容不生效 |
| B | 仅 Raid 专属效果（Switch to Active / Move to Front Line）在普通打出时失效，框内的其他能力（如 When Played）无论是否在框内仍然生效 |
| C | 规则上 Raid 框内的能力分为两类：Raid 专属条件和普通能力，需要在卡牌数据中分别标记 |

**你的裁决**：

```
[ 正确 ] A    [  ] B    [  ] C    [  ] 其他：______

补充说明：
____________________________________________________________
____________________________________________________________
```

---

### RQ-005：Energy Line + 标记的行为

**状态**：✅ 已确认（2026-08-03）— 裁决：B

**问题描述**：
规则手册 §Character Cards 写道：

> "A plus sign next to the energy generation icon indicates that the card has an effect that may increase the amount of its energy generation."

但规则手册未说明加号本身是否意味着可变量，还是仅作为"该卡上有能力可能改变能量生成量"的提醒。

需要确认：
- 加号（+）标记本身是否具有规则含义？还是纯粹的信息提示？
- 如果某卡有加号标记但卡上没有实际改变能量生成的能力，如何处理？
- 如果某卡有能力增加能量生成但没有加号标记，增加是否有效？

**规则来源**：`rules_EnglishVer.md` §Character Cards / §Site Cards

**影响模块**：`EnergySystem`、`CardSystem`（卡牌数据建模）

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | 加号纯属信息提示，无规则含义。能量生成量由卡上的实际能力决定 |
| B | 加号表示基础能量生成值可能因自身能力而变化（变化区间由能力定义） |
| C | 加号表示该卡的颜色能量生成量可以因任何效果而变化（不仅仅是自身能力） |

**你的裁决**：

```
[  ] A    [ 正确 ] B    [  ] C    [  ] 其他：______

补充说明：
____________________________________________________________
____________________________________________________________
```

---

### RQ-006：End Phase 手牌上限检查 — 弃牌选择权

**状态**：✅ 已确认（2026-08-03）— 裁决：A

**问题描述**：
规则手册 §End Phase 写道：

> "If you have more than eight cards in your hand, choose eight cards to keep. Place the remaining cards into your removal area."

未明确说明"choose"的选择权在谁。

需要确认：
- 选择权的"you"是回合玩家（即手牌持有者），还是对手？
- 可以合理推断为手牌持有者本人，但需确认。

**规则来源**：`rules_EnglishVer.md` §End Phase

**影响模块**：`TurnManager`、`ActionSystem`

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | 手牌持有者本人选择保留哪些（最合理的推断） |
| B | 对手选择弃哪些（但这极为反常） |
| C | 需要查阅日文原文确认 |

**你的裁决**：

```
[ 正确 ] A    [  ] B    [  ] C    [  ] 其他：______

补充说明：
____________________________________________________________
____________________________________________________________
```

---

### RQ-007：攻击阶段中 Trigger 是否算"使用卡牌"？

**状态**：✅ 已确认（2026-08-03）— 裁决：A

**问题描述**：
规则手册 §Attack Phase 写道：

> "Cards cannot be used during your attack phase."

但在攻击阶段中，如果造成伤害并翻开生命卡，Trigger 能力可能被发动。

需要确认：
- Trigger 能力的发动是否算"using a card"？
- 如果不算，Trigger 能力中如果有"Draw 1 card"效果 — 翻开的那张卡是 Trigger 的来源卡，还是独立结算？
- Event 卡上的 Trigger 在攻击阶段发动是否也被禁止？

**规则来源**：`rules_EnglishVer.md` §Attack Phase / §Trigger

**影响模块**：`RuleValidator`、`TriggerSystem`

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | Trigger 不算"use a card" — Trigger 是独立机制，攻击阶段可正常发动 Trigger 能力 |
| B | Trigger 算"use a card" — 但攻击阶段的 Trigger 例外允许 |
| C | Event 卡的 Trigger 不算"use"，因为 Event 卡本身不进入场上 |
| D | 需要查阅官方 FAQ |

**你的裁决**：

```
[ 正确 ] A    [  ] B    [  ] C    [  ] D    [  ] 其他：______

补充说明：
____________________________________________________________
____________________________________________________________
```

---

### RQ-008：先手第一回合 Main Phase 限制

**状态**：✅ 已确认（2026-08-03）— 裁决：B

**问题描述**：
规则手册明确说明：
- 先手第一回合 Start Phase 不抽牌（但可以额外抽牌）
- 先手第一回合只有 1 张 AP 卡

但未说明先手第一回合的 Main Phase 是否可以正常使用卡牌/发动能力。

需要确认：
- 先手第一回合是否可以打出卡牌？（1张AP理论上可以打出AP Cost为1的卡）
- 先手第一回合 AP 区有 1 张 Active AP 卡 ＋ 额外抽牌（支付1AP）— 这两者是否冲突？（即：用掉唯一的AP额外抽牌，就无法打出需要AP的卡）
- 是否有任何隐藏限制？

**规则来源**：`rules_EnglishVer.md` §Game Flow / §Start Phase

**影响模块**：`TurnManager`、`RuleValidator`

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | 无额外限制 — 先手第一回合 Main Phase 正常进行，使用卡牌/发动能力均可 |
| B | 先手第一回合不能进入 Attack Phase（但 Main Phase 正常） |
| C | 先手第一回合有特殊限制（请说明） |

**你的裁决**：

```
[  ] A    [ 正确 ] B    [  ] C    [  ] 其他：______

补充说明：
先手第一回合可以打出卡牌，第一回合额外抽牌和消耗ap打出卡牌不冲突，即用掉唯一的AP额外抽牌，就无法打出需要AP的卡____________________________________________________________
____________________________________________________________
```

---

### RQ-009：同时发动 — 新触发能力的队列插入位置

**状态**：⏳ 待查证（2026-08-03）— 裁决：D（需要查阅官方 FAQ）

**问题描述**：

> "If the resolution of one ability activates a new ability, that new ability is added to any remaining unresolved abilities and may also be resolved in any order desired."

需要确认：
- 「added to any remaining unresolved abilities」— 新能力是加入到一个扁平的剩余队列中，还是在回合玩家/非回合玩家的优先级框架下？
- 如果当前正在结算回合玩家的能力，新触发的能力属于对手 — 这个新能力是否有优先级？还是和回合玩家剩余能力一起任意排列？
- 具体场景：回合玩家有 A1、A2 两个能力待结算。结算 A1 时触发了对手的能力 B。此时剩余待结算队列是什么？

**规则来源**：`rules_EnglishVer.md` §When Multiple Abilities Activate Simultaneously

**影响模块**：`AbilitySystem`（AbilityQueue）

**可能答案**：

| 选项 | 描述 |
|------|------|
| A | 新能力加入剩余能力池，所有未结算能力（无论归属）可由当前回合玩家选择顺序 |
| B | 新能力保持其归属优先级 — 对手的能力 B 在所有回合玩家能力结算完后才结算 |
| C | 新能力立即加入当前批次——如果当前在结算回合玩家批次，则 B 也按回合玩家能力对待（可被任意排序） |
| D | 需要查阅官方 FAQ 或日文原文 |

**你的裁决**：

```
[  ] A    [  ] B    [  ] C    [ 正确 ] D    [  ] 其他：______

补充说明：
____________________________________________________________
____________________________________________________________
```

---

## 裁决汇总

| 编号 | 问题简述 | 裁决 | 日期 |
|------|---------|------|------|
| RQ-001 | When Played 触发范围 | C — 任意方式进场上即触发 | 2026-08-03 |
| RQ-002 | 入场角色攻击限制（召唤失调） | Other — Active/Resting 状态决定，无额外规则 | 2026-08-03 |
| RQ-003 | Start Phase 效果清除顺序 | A — 同时清除，无中间状态 | 2026-08-03 |
| RQ-004 | Raid 描述能力失效范围 | A — Raid 框内全部内容仅在 Raid 时生效 | 2026-08-03 |
| RQ-005 | Energy Line + 标记行为 | B — 加号表示自身能力可能改变能量生成量 | 2026-08-03 |
| RQ-006 | 手牌上限弃牌选择权 | A — 手牌持有者本人选择 | 2026-08-03 |
| RQ-007 | 攻击阶段 Trigger 算不算使用卡牌 | A — Trigger 不算"use a card" | 2026-08-03 |
| RQ-008 | 先手第一回合限制 | B — 不能进入 Attack Phase | 2026-08-03 |
| RQ-009 | 新触发能力的队列插入位置 | D — 待查阅官方 FAQ | 待定 |

---

> **关联文档**：
> - `Architecture.md` §8.4 — 架构评估中标注的规则疑点（来源）
> - `rules_EnglishVer.md` — 官方规则手册
> - `Game_Design.md` — 游戏整体设计
> - `Battle_System.md` — 战斗系统设计
> - `Card_System.md` — 卡牌系统设计
