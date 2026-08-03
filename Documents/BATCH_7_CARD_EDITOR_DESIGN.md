# Union Arena Digital — Batch 7: Card Editor Design

> 版本：1.0
> 日期：2026-08-04
> 状态：等待确认
> 前置：MVP 核心引擎完成（Batch 0-6）

---

## 一、目标

在不动 GameEngine 核心的前提下，构建独立的 **Card Editor（卡牌编辑器）**，从"规则模拟器"升级为"可操作游戏工具"。

### 用户故事

```
作为卡牌设计师，我想：
  1. 从模板创建新卡牌
  2. 编辑卡牌的所有字段（名称/BP/能量/能力/关键词/Raid/Trigger）
  3. 实时验证卡牌数据合法性
  4. 预览关键词展开结果
  5. 导出为标准 CardData JSON
  6. 在模拟器中测试卡牌

作为未来 Web 前端开发者，我想：
  7. 编辑器逻辑可嵌入 Web 客户端
  8. 编辑器的验证/预览引擎与 GameEngine 共享
```

---

## 二、架构设计

### 2.1 分层隔离

```
┌─────────────────────────────────────────────────────┐
│                  Card Editor (新)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   Web UI │  │  Console │  │  Programmatic API │   │
│  │ (HTML)   │  │   REPL   │  │  (可嵌入)         │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       └──────────────┼───────────────┘              │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐    │
│  │          CardEditorEngine (新)                │    │
│  │  create / update / validate / preview / export│    │
│  └──────────────────────┬───────────────────────┘    │
│                         │                             │
│         ┌───────────────┼───────────────┐            │
│         ▼               ▼               ▼            │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐     │
│  │ CardSchema │ │ CardSystem │ │ KeywordSystem│     │
│  │ (新)       │ │ (复用)     │ │ (复用)       │     │
│  └────────────┘ └────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────┘
                         │
        ═════════════════╪═════════════════  (边界)
                         │
┌────────────────────────▼────────────────────────────┐
│              GameEngine Core (不变)                   │
│  GameState / TurnManager / ActionSystem / ...        │
│  CardSystem.validateCard()                           │
│  CardSystem.expandKeywords()                          │
└──────────────────────────────────────────────────────┘
```

### 2.2 核心原则

| 原则 | 说明 |
|------|------|
| **零侵入** | GameEngine 核心一行不改 |
| **共享验证** | 复用 `CardSystem.validateCard()` — 编辑器验证 = 引擎验证 |
| **共享展开** | 复用 `CardSystem.expandKeywords()` — 编辑器预览 = 引擎实际 |
| **双向转换** | CardData ↔ JSON ↔ EditorState，三者之间无损转换 |
| **UI 无关** | CardEditorEngine 是纯逻辑层，Web UI / Console / API 是表现层 |

### 2.3 数据流

```
                    ┌─────────────────┐
                    │  现有 JSON 文件   │
                    └────────┬────────┘
                             │ CardSystem.loadCardsFromDirectory()
                             ▼
                    ┌─────────────────┐
                    │    CardData     │
                    └────────┬────────┘
                             │ CardEditorEngine.import()
                             ▼
                    ┌─────────────────┐
                    │  EditorState    │  ← 编辑器的内部状态（可撤销/重做）
                    └────────┬────────┘
                             │ CardEditorEngine.validate()
                             ▼
                    ┌─────────────────┐
                    │ ValidationResult│  ← 实时反馈
                    └────────┬────────┘
                             │ CardEditorEngine.preview()
                             ▼
                    ┌─────────────────┐
                    │ ExpandedCard    │  ← 预览关键词展开
                    └────────┬────────┘
                             │ CardEditorEngine.export()
                             ▼
                    ┌─────────────────┐
                    │   CardData JSON │  ← 写入文件
                    └─────────────────┘
```

---

## 三、文件结构

```
union-arena-sim/
├── src/                          # 已有 GameEngine（不变）
│   ├── core/...
│   ├── systems/...
│   └── data/...
│
├── editor/                       # 🆕 卡牌编辑器
│   ├── CardEditorEngine.ts       # 编辑器核心引擎（纯逻辑）
│   ├── CardSchema.ts             # 字段元数据定义（每个字段的 label/type/options/validation）
│   ├── EditorState.ts            # 编辑器内部状态管理（undo/redo/dirty tracking）
│   │
│   ├── server.ts                 # 开发服务器（Express 极简版）
│   │
│   ├── public/                   # Web UI
│   │   ├── index.html            # 编辑器主页面
│   │   ├── editor.css            # 样式
│   │   ├── editor.js             # 前端逻辑（Vanilla JS，零依赖）
│   │   └── preview/
│   │       └── preview.html      # 卡牌预览弹出窗口
│   │
│   └── cli/                      # Console 工具
│       └── card-creator.ts       # 命令行交互式创建向导
│
├── tests/
│   └── editor/                   # 🆕 编辑器测试
│       ├── CardEditorEngine.test.ts
│       ├── EditorState.test.ts
│       └── CardSchema.test.ts
│
└── package.json                  # + express + ts-node (dev)
```

---

## 四、核心模块设计

### 4.1 CardSchema（字段元数据）

定义每种卡牌类型的所有可编辑字段，每个字段包含：
- `fieldKey` — 对应 CardData 中的键
- `label` — 显示名称
- `type` — 输入控件类型（text / number / select / keyword-tags / ability-editor）
- `required` — 是否必填
- `cardTypes` — 适用的卡牌类型（['Character'] / ['Character','Site'] / all）
- `validation` — 前端即时校验规则

```typescript
// 示例：BP 字段定义
{
  fieldKey: 'bp.base',
  label: 'Base BP',
  type: 'number',
  required: true,
  cardTypes: ['Character'],
  validation: { min: 500, max: 15000, step: 500 },
  defaultValue: 3000,
}
```

CardSchema 的作用：
- **Web UI**：根据 CardSchema 自动渲染表单
- **Console**：根据 CardSchema 生成交互式提示
- **验证**：编辑器端即时检查（引擎端由 CardSystem.validateCard 做最终验证）

### 4.2 CardEditorEngine（编辑引擎）

```typescript
class CardEditorEngine {
  // 从 CardData 创建编辑器状态
  import(cardData: CardData): EditorState

  // 从 JSON 文件加载
  loadFromFile(filePath: string): EditorState

  // 创建空白模板
  createTemplate(cardType: CardType): EditorState

  // 更新单个字段
  updateField(state: EditorState, fieldKey: string, value: any): EditorState

  // 添加/编辑/删除能力
  addAbility(state: EditorState): EditorState
  updateAbility(state: EditorState, index: number, ability: AbilityData): EditorState
  removeAbility(state: EditorState, index: number): EditorState

  // 添加/编辑/删除 Raid
  setRaid(state: EditorState, raid: RaidData | null): EditorState

  // 添加/编辑/删除 Trigger
  setTrigger(state: EditorState, trigger: AbilityData | null): EditorState

  // 切换关键词
  toggleKeyword(state: EditorState, keyword: string): EditorState

  // 验证
  validate(state: EditorState): ValidationResult

  // 预览关键词展开
  previewExpansion(state: EditorState): ExpandedPreview

  // 导出为 CardData
  export(state: EditorState): CardData

  // 写入文件
  saveToFile(state: EditorState, filePath: string): void
}
```

### 4.3 EditorState（编辑状态）

```typescript
interface EditorState {
  // 编辑目标
  cardId: string;
  cardType: CardType;
  isNew: boolean;               // 新建 vs 编辑已有
  sourceFile?: string;          // 来源文件路径

  // 数据（与 CardData 对齐）
  fields: {
    cardName: string;
    sourceMaterial: string;
    affinities: string[];
    requiredEnergy: { color: string; amount: number };
    apCost: number;
    bp?: { base: number };
    energyGeneration: Array<{ color: string; amount: number }>;
  };

  // 复杂子对象
  abilities: AbilityData[];
  trigger: AbilityData | null;
  raid: RaidData | null;
  keywords: string[];

  // 元数据
  dirty: boolean;               // 是否有未保存修改
  validationErrors: string[];   // 当前验证错误

  // Undo/Redo
  history: EditorSnapshot[];
  historyIndex: number;
}
```

### 4.4 Ability Editor（子编辑器）

能力编辑是编辑器中最复杂的部分。需要提供：
- Timing 选择器（下拉框，13 种 timing）
- Condition 构建器（And/Or/Not 树形结构）
- Cost 添加器（多选 + 参数）
- Effect 添加器（多选 + 参数 + 嵌套 Sequence）

**MVP 简化方案**：能力编辑用 **JSON 文本编辑器 + 实时验证**，而非可视化构建器。降低 UI 复杂度。

```html
<!-- 能力编辑器 UI -->
<div class="ability-editor">
  <select name="timing">...</select>
  <textarea name="ability-json" rows="6">
    {
      "costs": [{"costType": "SwitchToResting"}],
      "effects": [{"effectType": "DrawCard", "params": {"count": 1}}]
    }
  </textarea>
  <span class="validation">✅ Valid</span>
</div>
```

| 方式 | 优点 | 缺点 | MVP 选择 |
|------|------|------|---------|
| 可视化构建器 | 用户友好，防错 | 开发量大，UI 复杂 | ❌ |
| **JSON 编辑器 + 验证** | 开发简单，灵活 | 需要用户懂 JSON | ✅ |
| 模板选择器 | 快速填充 | 模板数量有限 | 🔲 未来 |

---

## 五、Web UI 设计

### 5.1 技术选择

| 选项 | 评估 | 选择 |
|------|------|------|
| **Vanilla HTML/JS/CSS** | 零依赖，轻量，与未来 Web 客户端无框架冲突 | ✅ MVP |
| React/Vue | 更好的组件化，但增加依赖 | ❌ 过度（MVP） |
| Console TUI (blessed/ink) | 纯终端，符合 MVP 风格 | 🔲 备选 |
| Electron | 桌面应用，太重 | ❌ 不需要 |

**选择**：Vanilla HTML + Vanilla JS + CSS，通过 Express 静态托管。

### 5.2 页面布局

```
┌──────────────────────────────────────────────────────────┐
│  Union Arena Card Editor                    [Save] [Export]│
├────────────┬─────────────────────────────┬───────────────┤
│            │                             │               │
│  📋 Card   │  Card Name: [____________]  │  🔍 Preview   │
│   List     │                             │               │
│            │  Card Type: [Character ▾]   │  ┌─────────┐  │
│  HTR-1-001 │                             │  │ Card    │  │
│  HTR-1-002 │  Source:    [HTR_______]    │  │ preview │  │
│  HTR-1-003 │  Affinities: [Hunter] [+Add]│  │         │  │
│  ...       │                             │  │ BP:3000 │  │
│            │  ⚡ Required Energy         │  │ 白×1    │  │
│  [+ New]   │  Color: [白 ▾]  Amt: [1]   │  │         │  │
│            │                             │  │ [Snipe] │  │
│  📁 Import │  AP Cost: [1]              │  │ Trigger │  │
│  📥 Export │                             │  └─────────┘  │
│            │  ⚔ BP (Character only)      │               │
│            │  Base BP: [3000]            │  ⚠ Validation │
│            │                             │  ✅ All good  │
│            │  ── Abilities ──            │               │
│            │  [+ Add Ability]            │               │
│            │  ┌─────────────────────┐    │               │
│            │  │ #1 WhenPlayed       │    │               │
│            │  │   DrawCard(1)       │ ✕  │               │
│            │  └─────────────────────┘    │               │
│            │                             │               │
│            │  ── Raid ──                 │               │
│            │  [Enable Raid]              │               │
│            │                             │               │
│            │  🏷 Keywords:               │               │
│            │  [Snipe] [Impact 1] [+Add] │               │
│            │                             │               │
├────────────┴─────────────────────────────┴───────────────┤
│  Status: Card "HTR-1-001" loaded. 0 validation errors.    │
└──────────────────────────────────────────────────────────┘
```

### 5.3 交互流程

```
1. 打开编辑器 → 空白模板 或 加载已有卡牌列表
2. 选择卡牌 → 填充表单
3. 编辑字段 → 实时验证 → 预览更新
4. [Save] → CardEditorEngine.export() → CardSystem.validateCard() → 写入 JSON
5. [Export All] → 批量导出到 src/data/cards/
```

---

## 六、Console CLI 设计

### 6.1 交互式创建向导

```bash
$ npm run card-creator

Card Creator — Create a new Union Arena card
=============================================

Card Type? (Character/Site/Event)
> Character

Card ID? (e.g., HTR-1-021)
> HTR-1-021

Card Name?
> Test Warrior

Source Material?
> HTR

Required Energy Color? (白/红/蓝/绿/紫/黄)
> 白

Required Energy Amount? (1-10)
> 1

AP Cost? (0-3)
> 1

Base BP? (500-15000, step 500)
> 3500

Energy Generation Color? (白/红/蓝/绿/紫/黄)
> 白

Add Ability? (y/n)
> y

  Timing? (WhenPlayed/ActivateMain/WhenAttacking/...)
  > WhenPlayed

  Effects (JSON):
  > [{"effectType": "DrawCard", "params": {"count": 1}}]

  Costs (JSON):
  > []

Add Keywords? (comma-separated: Snipe, Impact 1, Damage 2, ...)
> Snipe

Add Trigger? (y/n)
> y

  Trigger Effects (JSON):
  > [{"effectType": "DrawCard", "params": {"count": 1}}]

---
Preview:
  HTR-1-021 "Test Warrior"  Character  白×1  AP:1  BP:3500
  [Snipe]
  WhenPlayed: Draw 1
  Trigger: Draw 1

Save to file? (src/data/cards/custom/HTR-1-021.json)
> y

✅ Card saved.
```

### 6.2 批量操作

```bash
$ npm run card-creator -- --validate-all    # 验证所有卡牌
$ npm run card-creator -- --export-template # 输出空白模板
```

---

## 七、与 GameEngine 的集成边界

```
                    Editor 可调用                    Editor 不可调用
                    ────────────                    ──────────────
CardSystem:         validateCard()                  loadCardsFromDirectory() (只读)
                    expandKeywords()                 createRegistry() (只读)
                    loadKeywordDefinitions()

types.ts:           所有 CardData 类型               GameState / PlayerState
                    AbilityData / EffectData         ActionRequest / BattleState

不依赖:             GameEngine / GameState / ActionSystem
                    TurnManager / BattleSystem / ...
```

**关键约束**：编辑器**不 import** 任何 `src/core/` 中除了 `types.ts` 以外的模块。它只依赖：
1. `src/core/types.ts` — 类型定义
2. `src/systems/CardSystem.ts` — 验证 + 关键词展开
3. `src/data/keywords/` — 关键词定义

---

## 八、开发计划

### Batch 7.1 — CardEditorEngine 核心 (纯逻辑，无UI)

| 任务 | 说明 |
|------|------|
| `CardSchema.ts` | 定义所有卡牌字段的元数据 |
| `EditorState.ts` | 编辑器状态 + undo/redo + dirty tracking |
| `CardEditorEngine.ts` | import/export/create/update/validate/preview |

**测试**：`CardEditorEngine.test.ts` 覆盖全部 CRUD 操作 + 验证

### Batch 7.2 — Web UI

| 任务 | 说明 |
|------|------|
| `server.ts` | Express 静态服务 + 文件读写 API |
| `index.html` + `editor.css` | 编辑器布局 + 样式 |
| `editor.js` | 前端逻辑：表单渲染 + 实时验证 + 预览更新 + 保存 |

### Batch 7.3 — Console CLI + 文档

| 任务 | 说明 |
|------|------|
| `card-creator.ts` | 交互式创建向导 |
| 批量验证脚本 | 验证所有卡牌 |
| 使用文档 | README 卡牌编辑器章节 |

---

## 九、风险分析

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| **Ability 编辑 UX 困难** | 高 | 中 | MVP 用 JSON 编辑器 + 模板。未来加可视化构建器 |
| **EditorState 与 CardData 字段不同步** | 中 | 高 | CardSchema 作为单一数据源驱动两者。`export()` 有字段完整性检查 |
| **验证逻辑重复** | 中 | 低 | 编辑器验证 **委托** CardSystem.validateCard()，不做二次实现 |
| **Web UI 与未来 Web 客户端不一致** | 低 | 中 | Vanilla JS 零框架，未来可替换为任何框架。CardEditorEngine 纯逻辑与 UI 无关 |
| **Undo/Redo 内存占用** | 低 | 低 | EditorSnapshot 只存 diff，非全量快照 |
| **Express 依赖** | 低 | 低 | 仅 dev 依赖，不进入生产构建。未来 Web 客户端有自己的服务端 |

---

## 十、总结

| 维度 | 决策 |
|------|------|
| **架构** | CardEditorEngine（纯逻辑）+ Web UI / Console CLI（表现层）|
| **UI 技术** | Vanilla HTML/JS/CSS + Express 静态服务 |
| **CLI 技术** | Node.js readline 交互式向导 |
| **验证** | 复用 CardSystem.validateCard() + CardSystem.expandKeywords() |
| **存储** | 直接读写 JSON 文件（`src/data/cards/custom/`） |
| **GameEngine** | 零修改 |
| **开发顺序** | 引擎 → Web UI → Console CLI |

---

> **关联文档**：
> - `Card_System.md` — 卡牌数据结构规范
> - `MVP_IMPLEMENTATION_PLAN.md` — MVP 范围
> - `ARCHITECTURE_DECISIONS.md` — 已有架构决策
