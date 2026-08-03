# Union Arena Digital Project

## 项目目标

将实体卡牌游戏 **Union Arena** 电子游戏化，开发浏览器端可运行的数字卡牌对战游戏。

核心功能目标：
- 卡牌收集 / 卡组构筑 / 回合制战斗 / 卡牌效果结算 / AI 对战

## 项目定位

- 类型：Digital TCG + Turn-based Strategy
- 规则核心：Union Arena 官方规则手册 Ver1.1
- 参考产品：Hearthstone / MTG Arena / Master Duel
- 运行平台：浏览器

## 技术栈

| 层 | 技术 |
|----|------|
| Frontend | Phaser + TypeScript + HTML5 Canvas/WebGL |
| Backend | Node.js |
| Data | JSON card database |
| Architecture | Client(渲染/动画) / Server(规则/验证) |

## 开发原则

1. **卡牌数据和游戏逻辑分离** — 卡牌信息存储在 JSON，引擎只解释数据
2. **不为单张卡牌写硬编码** — 所有效果通过数据配置实现
3. **系统设计可扩展** — 新增卡包只需添加数据文件

## 当前状态

**阶段 1（规则研究 + 设计）— 已完成 ✅**

- [x] 规则文档提取：`Documents/rules_EnglishVer/hybrid_auto/rules_EnglishVer.md`
- [x] 游戏整体设计：`Documents/design/Game_Design.md`
- [x] 战斗系统设计：`Documents/design/Battle_System.md`
- [x] 卡牌系统设计：`Documents/design/Card_System.md`

**阶段 1.5（架构设计 + 规则确认）— 已完成 ✅**

- [x] 核心规则引擎架构设计：`Documents/Architecture.md`（16 模块 / 3 层架构）
- [x] 规则疑点确认清单：`Documents/Rule_Resolution.md`（9 条疑点，8 已确认，1 待查证）
- [x] 规则裁决影响报告：`Documents/Rule_Impact_Report.md`（MVP 无阻塞）

**阶段 2（MVP 核心引擎开发）— 准备就绪 🔲**

**阶段 3（UI / AI / 网络）— 未开始 🔲**

详见 `Documents/Project_Roadmap.md`

---

## 已完成的重要决策

1. **Rule Resolution 规则裁决流程** — 所有未明确规则必须记录到 `Rule_Resolution.md`，由项目负责人裁决，不允许 AI 自行假设
2. **MVP 优先原则** — MVP 阶段只开发核心规则引擎，不开发 UI、动画、联机系统
3. **数据驱动架构** — 卡牌数据（JSON）与游戏逻辑（引擎）完全分离，引擎通过 EventBus + 状态机驱动
4. **不可变 GameState** — 所有状态变更产生新版本，支持回溯和 replay
5. **关键词预展开** — 卡牌加载时将关键词展开为等效能力条目，引擎运行时无需区分

---

## MVP 开发目标

制作可单机运行的 Union Arena 数字版 MVP：

- **目标**：完成一局基础对战流程，验证规则引擎正确性
- **交付形式**：Console 版本规则模拟器（无 UI）
- **核心模块**（16 模块中 MVP 需要的 13 个）：
  - GameEngine / GameState / TurnManager / ActionSystem / RuleValidator
  - CardSystem / EnergySystem / AbilitySystem / BattleSystem
  - MovementSystem / DamageSystem / TriggerSystem / EventBus
- **MVP 暂缓模块**：RaidSystem / StateHistory / DeckBuilder（可后续加入）

---

## 下一步计划

### 立即任务

1. **创建 Demo Card Set** — 20 张测试卡，覆盖 4 种卡牌类型 + 全部 9 种关键词
2. **创建 Demo Test Cases** — 针对每个核心系统的单元测试场景
3. **搭建项目骨架** — Node.js/TypeScript 项目 + 测试框架 + 卡牌 JSON Schema

### 核心开发（按 Batch 顺序）

4. **Batch 0 — 基础设施**：卡牌 JSON Schema / 测试卡数据 / EventBus / 基础类型
5. **Batch 1 — 数据与状态**：CardSystem / GameState / StateHistory
6. **Batch 2 — 流程控制**：TurnManager / EnergySystem / MovementSystem / RuleValidator
7. **Batch 3 — 能力与战斗**：AbilitySystem（条件/代价/效果/队列/Duration）/ DamageSystem / TriggerSystem / BattleSystem

### 测试验证

8. **Turn System 测试** — 5 阶段状态机 + 先手首回合限制（RQ-008）
9. **Battle System 测试** — 攻击→阻挡→BP结算→伤害→Trigger 完整流程
10. **Ability System 测试** — When Played / Activate: Main / 持续性效果 / 同时发动队列
11. **Raid System 测试** — Raid 堆叠 / 能力分离（RQ-004）
12. **Trigger System 测试** — 多点伤害 / 任意顺序 / Attack Phase 允许（RQ-007）

---

## 参考文档

| 文档 | 路径 | 用途 |
|------|------|------|
| 核心规则 | `Documents/rules_EnglishVer/hybrid_auto/rules_EnglishVer.md` | 规则权威来源 |
| 游戏设计 | `Documents/design/Game_Design.md` | 流程/场地/回合/AP/状态机 |
| 战斗设计 | `Documents/design/Battle_System.md` | 攻击阶段/BP结算/伤害/Trigger |
| 卡牌设计 | `Documents/design/Card_System.md` | 卡牌类型/数据结构/能力系统/DSL |
| 架构设计 | `Documents/Architecture.md` | 16 模块架构/数据流/效果系统 |
| 规则疑点 | `Documents/Rule_Resolution.md` | 9 条规则疑点与裁决 |
| 影响报告 | `Documents/Rule_Impact_Report.md` | 裁决对系统的具体影响 |
| 路线图 | `Documents/Project_Roadmap.md` | 阶段规划 |

> 开发以规则文档为准。规则文档没有说明的内容，**不允许自行假设**，必须记录到 `Rule_Resolution.md` 等待裁决。

# Test

如果读取到此文件，请回复：
「Union Arena 项目记忆加载成功」