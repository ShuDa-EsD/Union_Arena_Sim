# Union Arena Digital MVP

Console-based rule simulator for the Union Arena TCG, plus a Card Editor (Web + CLI).
**Version: v0.1.0 (MVP Core) + Phase 2 (Card Editor)**

## Quick Start

```bash
npm install
npm test                         # Run all tests (248 tests, 22 suites)
npm run build                    # Compile TypeScript (src/ only)
npm run scenario basic_game      # Run basic game scenario

npm run editor                   # Start Web Card Editor → http://localhost:3000
npm run card-creator             # Interactive CLI card creator
npm run card-creator -- --export-template AP     # Print a blank template
npm run card-creator -- --validate-all           # Validate all cards (custom/ + test_set/)
```

## MVP Scope (Phase 1 — Core Engine)

### ✅ Implemented

| System | Description |
|--------|-------------|
| GameState | Immutable state, 7 zones per player, state version tracking |
| CardSystem | JSON card loading, validation, keyword expansion (9 keywords) |
| TurnManager | 5-phase FSM (Start→Movement→Main→Attack→End), RQ-008 |
| EnergySystem | Energy pool calculation, color matching, canAfford |
| MovementSystem | Energy→Front line movement, capacity overflow |
| RuleValidator | Phase permissions, energy/AP/zone validation |
| ActionSystem | PlayCharacter/Site/Event, PerformRaid, ActivateAbility, ExtraDraw |
| AbilitySystem | Trigger detection, condition eval, cost payment, effect execution, queue |
| BattleSystem | Attack→Block→BP compare→Damage→Trigger→DoubleAttack |
| DamageSystem | Damage calculation (base/Damage2/Damage+1) |
| TriggerSystem | Trigger check, auto-activation, multi-trigger processing |
| RaidSystem | Raid validation (Name/Affinity), stacking, RQ-004 |
| GameEngine | Facade: newGame, advancePhase, submitAction, battle API |

### Test Cards (20 cards)

| # | ID | Type | Key Feature |
|---|-----|------|-------------|
| 1-4 | HTR-1-001~004 | Character | Vanilla (3000-5000 BP) |
| 5 | HTR-1-005 | Site | Basic energy source |
| 6 | HTR-1-006 | Event | Draw 1 |
| 7-8 | HTR-1-007~008 | Character | WhenPlayed: Draw |
| 9 | HTR-1-009 | Character | ActivateMain: ↻+Pay1AP→Draw1 |
| 10 | HTR-1-010 | Character | WhenPlayed: BP+1000 |
| 11 | HTR-1-011 | Event | Sideline opponent character |
| 12 | HTR-1-012 | Site | WhenPlayed: Draw |
| 13 | HTR-1-013 | Character | [Snipe] + Trigger:Draw |
| 14 | HTR-1-014 | Character | [Impact 1] |
| 15 | HTR-1-015 | Character | [Damage 2] |
| 16 | HTR-1-016 | Character | WhenAttacking: BP+2000 |
| 17 | HTR-1-017 | Character | Raid(target:HTR-1-001) |
| 18 | HTR-1-018 | Character | Raid(target:HTR-1-002)+WhenPlayed |
| 19 | HTR-1-019 | Character | [Double Attack] |
| 20 | HTR-1-020 | Character | [Step, Nullify Impact] |

### Keywords (9 keywords)

Snipe / Impact 1 / Impact +1 / Damage 2 / Damage +1 / Double Attack / Double Block / Step / Nullify Impact

## Card Editor (Phase 2)

### Three components & their relationship

```
┌─────────────────────────┐   ┌───────────────────────────┐
│  Web Editor (browser)   │   │  CLI Card Creator (终端)   │
│  editor/public/*        │   │  editor/cli/card-creator  │
└───────────┬─────────────┘   └───────────┬───────────────┘
            │    HTTP /api/*               │   直接调用
            ▼                             ▼
        ┌─────────────────────────────────────────────┐
        │        CardEditorEngine（纯逻辑核心）          │
        │  editor/CardEditorEngine.ts                 │
        │  create/update/validate/preview/save/undo   │
        └───────────────────┬─────────────────────────┘
                            │ 复用（不重写规则）
                            ▼
        ┌─────────────────────────────────────────────┐
        │  CardSystem.validateCard() / expandKeywords()│
        │  CardSchema（字段元数据 + 模板）               │
        └─────────────────────────────────────────────┘
```

- **CardEditorEngine**（`editor/`）是唯一编辑逻辑核心，纯 TypeScript，不依赖 DOM / Express / readline。
- **Web Editor** 是浏览器端表现层（Vanilla JS），通过 `editor/server.ts`（Express）的 REST API 间接调用引擎。浏览器不 import 任何 TS，也不复制任何规则逻辑。
- **CLI Card Creator** 是终端表现层（readline），直接调用引擎。
- 三者的验证/关键词展开**始终**复用 `CardSystem`，编辑器与引擎共享同一套规则。

### Save location

- 新建/保存的卡一律写入 **`src/data/cards/custom/`**。
- `src/data/cards/test_set/` 是只读参考数据，Save 永远不会覆盖它。
- Web Editor 的 Save（`POST /api/cards`）由服务器强制写入 `custom/`，前端无法指定任意路径；`cardId` 会校验并拒绝路径分隔符与 `..`。

### Web Editor API

`GET /api/schema` · `GET /api/template?cardType=X` · `GET /api/keywords` · `GET /api/cards` · `GET /api/cards/:id` · `POST /api/cards` · `PUT /api/cards/:id` · `POST /api/validate` · `POST /api/preview`

## Architecture Decisions

See `Documents/ARCHITECTURE_DECISIONS.md` for all recorded decisions (AD-001 through AD-016).

## Known MVP Limitations

| ID | Limitation | Impact |
|----|-----------|--------|
| RQ-009 | Ability queue insertion order for new triggers | Default: priority-batch strategy |
| TR-001 | Trigger activation is automatic (no player choice) | All triggers auto-fire |
| MV-001 | Step (reverse movement) not integrated | MovementSystem only supports forward moves |
| DM-001 | Damage 2 + Damage +1 stacking unconfirmed | Uses multiplier+bonus formula |
| BT-001 | BP comparison uses current (live) BP, not snapshot | May diverge from rules if BP changes during battle |
| UI | No graphical game interface | Console-only MVP |

### Editor limitations

| Limitation | Impact |
|-----------|--------|
| `editor/` not in `tsc` build (`rootDir: src`) | Editor code is type-checked by ts-jest, not `npm run build` |
| Ability/Trigger/Raid edited as JSON text | No visual node editor (per design: JSON editor MVP) |
| Client-side undo/redo is a simple snapshot stack | Character-by-character undo (no input coalescing) |
| Changing cardType mid-edit does not auto-restructure fields | `validateCard` reports type-field mismatches |

## Project Structure

```
src/
├── index.ts               # Entry point
├── core/                  # GameState, GameEngine, TurnManager, RuleValidator, ActionSystem, EventBus, types
├── systems/               # CardSystem, EnergySystem, MovementSystem, AbilitySystem, BattleSystem, DamageSystem, TriggerSystem, RaidSystem
├── data/
│   ├── cards/test_set/    # 20 test cards (read-only reference)
│   ├── cards/custom/      # Custom cards created via the editor/CLI
│   └── keywords/          # Keyword definitions
└── scenarios/             # Game scenarios

editor/                    # Card Editor (Phase 2)
├── CardEditorEngine.ts    # Pure editing core
├── CardSchema.ts          # Field metadata + templates
├── EditorState.ts         # Undo/redo + dirty tracking
├── server.ts              # Express static + REST API
├── public/                # Web UI (index.html / editor.css / editor.js)
└── cli/card-creator.ts    # Interactive CLI creator

tests/                     # 248 tests across 22 suites
Documents/                 # Design & architecture docs
```

## Rule References

- Official Rulebook Ver1.1: `Documents/rules_EnglishVer/hybrid_auto/rules_EnglishVer.md`
- Rule Resolutions (9 items, 8 confirmed): `Documents/Rule_Resolution.md`
- Architecture: `Documents/Architecture.md`
- Development Plan: `Documents/DEVELOPMENT_BATCH_PLAN.md`

## License

UNLICENSED — Development preview
