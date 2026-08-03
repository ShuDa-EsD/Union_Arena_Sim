# Union Arena Digital MVP

Console-based rule simulator for the Union Arena TCG.  
**Version: v0.1.0 (MVP)**

## Quick Start

```bash
npm install
npm test                  # Run all tests (181 tests, 17 suites)
npm run build             # Compile TypeScript
npm run scenario basic_game  # Run basic game scenario
```

## MVP Scope

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
| UI | No graphical interface | Console-only MVP |

## Project Structure

```
src/
├── index.ts               # Entry point
├── core/
│   ├── types.ts           # All types & interfaces
│   ├── GameEngine.ts      # Facade
│   ├── GameState.ts       # Immutable state
│   ├── EventBus.ts        # Event pub/sub
│   ├── TurnManager.ts     # 5-phase FSM
│   ├── RuleValidator.ts   # Rule checks
│   └── ActionSystem.ts    # Action pipeline
├── systems/
│   ├── CardSystem.ts      # Card loading + keywords
│   ├── EnergySystem.ts    # Energy calculation
│   ├── MovementSystem.ts  # Movement logic
│   ├── AbilitySystem.ts   # Ability resolution
│   ├── BattleSystem.ts    # Battle flow
│   ├── DamageSystem.ts    # Damage calculation
│   ├── TriggerSystem.ts   # Trigger processing
│   └── RaidSystem.ts      # Raid mechanics
├── data/
│   ├── cards/test_set/    # 20 test cards
│   └── keywords/          # Keyword definitions
└── scenarios/             # Game scenarios

tests/                     # 181 tests across 17 suites

Documents/                 # Design & architecture docs
```

## Rule References

- Official Rulebook Ver1.1: `Documents/rules_EnglishVer/hybrid_auto/rules_EnglishVer.md`
- Rule Resolutions (9 items, 8 confirmed): `Documents/Rule_Resolution.md`
- Architecture: `Documents/Architecture.md`
- Development Plan: `Documents/DEVELOPMENT_BATCH_PLAN.md`

## License

UNLICENSED — Development preview
