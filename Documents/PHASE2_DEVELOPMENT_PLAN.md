# Union Arena Digital — Phase 2 Development Plan

> 版本：1.0
> 创建日期：2026-08-04
> 状态：Ready
> 前置：Phase 1 MVP Core Complete (Batch 0-6)
>
> 本文档是 Phase 2（Card Editor + Web Client）的**开发总入口**。
> 合并自：`PROJECT_STATUS_PHASE2.md` + `BATCH_7_CARD_EDITOR_DESIGN.md`
> **不修改已有文件。**

---

## 一、Current State

### 1.1 Phase 1 交付物

| 维度 | 数值 |
|------|------|
| 版本 | v0.1.0 |
| 核心模块 | 14（7 core + 8 systems - 1 unused） |
| 测试卡牌 | 20 张（4 种类型，9 种关键词） |
| 测试用例 | 181 tests，17 suites |
| TypeScript | 零类型错误 |
| 运行方式 | Console：`npm run scenario basic_game` |

### 1.2 已有模块清单

```
src/core/
  types.ts          — 全部类型定义
  GameEngine.ts     — 门面类（newGame / advancePhase / submitAction / battle API）
  GameState.ts      — 不可变状态 + applyChanges
  EventBus.ts       — 同步事件总线
  TurnManager.ts    — 5 阶段 FSM
  RuleValidator.ts  — 规则验证
  ActionSystem.ts   — 操作管道

src/systems/
  CardSystem.ts     — JSON 加载 + 验证 + 关键词展开 + CardRegistry
  EnergySystem.ts   — 能量计算
  MovementSystem.ts — 移动管理
  AbilitySystem.ts  — 能力结算引擎
  BattleSystem.ts   — 战斗流程
  DamageSystem.ts   — 伤害计算
  TriggerSystem.ts  — Trigger 处理
  RaidSystem.ts     — Raid 堆叠

src/data/
  cards/test_set/   — 20 张 JSON 卡牌
  keywords/         — 9 种关键词定义
```

### 1.3 关键架构决策（16 条）

参见 `ARCHITECTURE_DECISIONS.md` (AD-001 ~ AD-016)。Phase 2 必须遵守的核心约束：

- **AD-003**：Player-scoped 状态变化通过 StateChange + applyChanges
- **AD-004**：RuleValidator 作为统一规则验证入口
- **AD-007**：运行时实例(CardInZone) 与静态数据(CardData) 分离
- **AD-008**：ActionSystem 是玩家操作的唯一入口

---

## 二、Phase 2 Goal

### 2.1 总体目标

从"规则模拟器"升级为"可操作游戏工具"。

### 2.2 具体交付

| 交付物 | 说明 | 优先级 |
|--------|------|--------|
| **CardEditorEngine** | 纯逻辑编辑引擎（创建/编辑/验证/预览/导出 CardData） | P0 |
| **Web Card Editor** | 浏览器端卡牌编辑器 UI | P1 |
| **Console Card Creator** | 命令行交互式卡牌创建向导 | P2 |

### 2.3 用户故事

```
作为卡牌设计师：
  1. 从模板创建新卡牌
  2. 编辑卡牌所有字段（名称/BP/能量/能力/关键词/Raid/Trigger）
  3. 实时验证卡牌数据合法性
  4. 预览关键词展开结果
  5. 导出为标准 CardData JSON（与 GameEngine 完全兼容）
  6. 在模拟器中测试新卡牌

作为未来 Web 前端开发者：
  7. CardEditorEngine 可嵌入 Web 客户端（无框架依赖）
  8. 验证/预览使用与 GameEngine 相同的 CardSystem
```

---

## 三、Architecture

### 3.1 三层架构

```
┌──────────────────────────────────────────────────────────┐
│                    Card Editor（Phase 2 新建）             │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Web UI     │  │ Console CLI  │  │ Programmatic   │  │
│  │ (HTML/JS)    │  │ (readline)   │  │ API (可嵌入)   │  │
│  │ port :3000   │  │ npm run card │  │ import { ... }  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         └─────────────────┼──────────────────┘            │
│                           ▼                                │
│  ┌────────────────────────────────────────────────────┐   │
│  │              CardEditorEngine（纯逻辑）              │   │
│  │  create() / update() / validate() / preview()      │   │
│  │  export() / import() / undo() / redo()             │   │
│  └────────────────────┬───────────────────────────────┘   │
│                       │                                    │
│          ┌────────────┼────────────┐                      │
│          ▼            ▼            ▼                      │
│  ┌────────────┐ ┌──────────┐ ┌──────────────┐            │
│  │ CardSchema │ │CardSystem│ │KeywordSystem │            │
│  │  (新)      │ │ (复用)   │ │  (复用)      │            │
│  └────────────┘ └──────────┘ └──────────────┘            │
│                                                            │
└────────────────────────┬─────────────────────────────────┘
                         │
     ════════════════════╪══════════════════  (编辑器 / 引擎边界)
                         │
┌────────────────────────▼─────────────────────────────────┐
│              GameEngine Core（Phase 1 — 不可修改）         │
│  types.ts  / GameEngine  / GameState  / TurnManager      │
│  ActionSystem  / BattleSystem  / AbilitySystem  / ...    │
└──────────────────────────────────────────────────────────┘
```

### 3.2 边界约束

| 编辑器可以访问 | 编辑器不可以访问 |
|---------------|-----------------|
| `src/core/types.ts` — 所有类型定义 | `GameEngine` / `GameState` |
| `src/systems/CardSystem.ts` — validateCard / expandKeywords / loadKeywordDefinitions | `TurnManager` / `ActionSystem` |
| `src/data/keywords/keyword_definitions.json` | `BattleSystem` / `AbilitySystem` |
| `src/data/cards/` — 读写卡牌 JSON | `EventBus` |

**核心原则**：编辑器验证 = 引擎验证（共享 `CardSystem.validateCard()`），编辑器预览 = 引擎实际（共享 `CardSystem.expandKeywords()`）。

### 3.3 数据流

```
JSON 文件 ──import()──▶ CardData ──▶ EditorState ──▶ 用户编辑
                                              │
                          ┌───────────────────┘
                          ▼
                    validate() ──▶ ValidationResult（实时反馈）
                          │
                          ▼
                    preview() ──▶ ExpandedCard（关键词展开预览）
                          │
                          ▼
                    export() ──▶ CardData ──▶ JSON 文件
```

---

## 四、Development Roadmap

### 4.1 Batch 7.1 — CardEditorEngine Core（纯逻辑，无 UI）

**目标**：实现卡牌编辑的全部核心逻辑，可独立测试。

**文件**：

```
editor/
├── CardEditorEngine.ts    — 编辑引擎（create / update / validate / preview / export / import）
├── CardSchema.ts          — 字段元数据定义
├── EditorState.ts         — 编辑器状态管理（undo/redo / dirty tracking）
```

**关键 API**：

```typescript
class CardEditorEngine {
  import(cardData: CardData): EditorState
  loadFromFile(filePath: string): EditorState
  createTemplate(cardType: CardType): EditorState
  updateField(state: EditorState, fieldKey: string, value: any): EditorState
  addAbility(state: EditorState): EditorState
  updateAbility(state: EditorState, index: number, ability: AbilityData): EditorState
  removeAbility(state: EditorState, index: number): EditorState
  setRaid(state: EditorState, raid: RaidData | null): EditorState
  setTrigger(state: EditorState, trigger: AbilityData | null): EditorState
  toggleKeyword(state: EditorState, keyword: string): EditorState
  validate(state: EditorState): ValidationResult
  previewExpansion(state: EditorState): ExpandedPreview
  export(state: EditorState): CardData
  saveToFile(state: EditorState, filePath: string): void
  undo(state: EditorState): EditorState
  redo(state: EditorState): EditorState
}
```

**完成标准**：
- [ ] CardEditorEngine 全部方法可测试（无需 UI）
- [ ] 创建 Character/Site/Event 三种模板
- [ ] 编辑所有字段 + 实时验证
- [ ] 关键词展开预览正确
- [ ] 导出 JSON 与 GameEngine 兼容
- [ ] Undo/Redo 正确

**测试**：
```
tests/editor/
├── CardEditorEngine.test.ts
├── CardSchema.test.ts
└── EditorState.test.ts
```

**限制**：不依赖 Express / 浏览器 / DOM。纯 Node.js 可运行。

---

### 4.2 Batch 7.2 — Web UI

**目标**：浏览器端卡牌编辑器，可视化编辑 + 实时预览。

**文件**：

```
editor/
├── server.ts              — Express 静态服务 + 文件读写 API
└── public/
    ├── index.html         — 编辑器主页面
    ├── editor.css         — 样式
    └── editor.js          — 前端逻辑（Vanilla JS，零框架依赖）
```

**页面布局**：

```
┌──────────────────────────────────────────────────┐
│  Union Arena Card Editor          [Save] [Export] │
├──────────┬───────────────────────┬───────────────┤
│ Card     │ Card Name: [_______]  │ Preview       │
│ List     │ Card Type: [Char ▾]   │ ┌───────────┐ │
│          │ Source:    [HTR____]  │ │ BP: 3000  │ │
│ [+New]   │ Affinities: [+Add]    │ │ 白×1      │ │
│          │ AP Cost: [1]          │ │ [Snipe]   │ │
│ 📁 Import│ Base BP: [3000]       │ │           │ │
│ 📥 Export│                       │ └───────────┘ │
│          │ ⚡ Required Energy    │               │
│          │ ── Abilities ──      │ ⚠ Validation  │
│          │ [+Add] [✕] [✕]      │ ✅ All good   │
│          │ ── Raid ──           │               │
│          │ 🏷 Keywords: [+Add] │               │
├──────────┴───────────────────────┴───────────────┤
│  Status: Card "HTR-1-021" loaded. 0 errors.       │
└──────────────────────────────────────────────────┘
```

**Server API**：

```
GET  /api/cards              — 列出所有卡牌
GET  /api/cards/:id          — 获取单张卡牌
POST /api/cards              — 创建新卡牌
PUT  /api/cards/:id          — 更新卡牌
GET  /api/keywords           — 获取关键词列表
POST /api/validate           — 验证 CardData
POST /api/preview            — 预览关键词展开
```

**完成标准**：
- [ ] `npm run editor` 启动服务器 → 浏览器打开编辑器
- [ ] 可以加载现有 20 张卡牌之一并编辑
- [ ] 可以创建新卡牌、选择关键词、添加能力
- [ ] 实时验证：错误字段高亮
- [ ] 关键词展开预览实时更新
- [ ] Save 写入 JSON 文件

**依赖**（仅 dev）：

```json
"devDependencies": {
  "express": "^4.18.0",
  "@types/express": "^4.17.0"
}
```

---

### 4.3 Batch 7.3 — Console CLI + 文档

**目标**：命令行交互式创建向导 + 使用文档。

**文件**：

```
editor/
└── cli/
    └── card-creator.ts     — 交互式创建向导（readline）
```

**交互流程**：

```
$ npm run card-creator

Card Creator — Create a new Union Arena card
=============================================

Card Type? (Character/Site/Event)
> Character

Card ID? (e.g., HTR-1-021)
> HTR-1-021

Card Name?
> Phoenix Hunter

Required Energy Color? (白/红/蓝/绿/紫/黄)
> 白

...（逐步引导所有字段）

Preview:
  HTR-1-021 "Phoenix Hunter"  Character  白×1  AP:1  BP:3500
  [Snipe]
  WhenPlayed: Draw 1

Save to file? (src/data/cards/custom/HTR-1-021.json)
> y

✅ Card saved.
```

**完成标准**：
- [ ] `npm run card-creator` 可用
- [ ] `npm run card-creator -- --validate-all` 验证全部卡牌
- [ ] `npm run card-creator -- --export-template` 输出空白模板
- [ ] README 更新：Card Editor 使用说明

---

## 五、Rules

### Phase 2 必须遵守的规则：

| # | 规则 | 原因 |
|---|------|------|
| 1 | **不破坏 GameEngine** | Phase 1 是经过了 181 个测试验证的稳定核心。Phase 2 新增代码不能导致任何已有测试失败 |
| 2 | **不修改核心规则系统** | `src/core/` 和 `src/systems/` 中的已有文件只能增加导出，不能修改逻辑。如果必须修改，先记录到 ARCHITECTURE_DECISIONS.md 并等待确认 |
| 3 | **编辑器只依赖 CardSystem + types** | 编辑器的 import 范围：`src/core/types.ts` + `src/systems/CardSystem.ts`。不 import GameEngine / GameState / TurnManager / 等 |
| 4 | **卡牌 JSON 保持兼容** | 编辑器导出的 JSON 必须通过 `CardSystem.validateCard()` 验证。必须能被 `CardSystem.loadCardsFromDirectory()` 加载 |
| 5 | **编辑器逻辑与 UI 分离** | `CardEditorEngine` 是纯 TypeScript 类，不依赖 DOM / Express / readline。可以嵌入任何 UI 层 |
| 6 | **不修改已有文档** | `PROJECT_STATUS_PHASE2.md` / `BATCH_7_CARD_EDITOR_DESIGN.md` / 所有 Phase 1 文档保持原样 |
| 7 | **测试覆盖** | 每个 Batch 提交时测试必须全部绿色（`npm test` 181 tests pass） |

### 违反规则的后果

- 规则 1/2 违反 → Phase 1 回归风险，需要完整的回归测试
- 规则 3 违反 → 编辑器与引擎耦合，未来 Web Client 无法独立部署
- 规则 4 违反 → 编辑器创建的卡牌在模拟器中加载失败
- 规则 5 违反 → Web UI 和 Console CLI 代码重复

---

## 六、Next Action

> **立即进入 Batch 7.1 — CardEditorEngine Core**
>
> 1. 创建 `editor/` 目录
> 2. 实现 `CardSchema.ts`（字段元数据）
> 3. 实现 `EditorState.ts`（状态管理 + undo/redo）
> 4. 实现 `CardEditorEngine.ts`（全部 CRUD + 验证 + 预览 + 导出）
> 5. 编写 `tests/editor/` 测试
> 6. 确保 `npm test` 181 + 新增 = 全部通过

---

> **关联文档**：
> - `PROJECT_STATUS_PHASE2.md` — Phase 1 完成状态快照
> - `BATCH_7_CARD_EDITOR_DESIGN.md` — Card Editor 详细设计
> - `ARCHITECTURE_DECISIONS.md` — 16 条架构决策
> - `Architecture.md` — 完整 16 模块架构
