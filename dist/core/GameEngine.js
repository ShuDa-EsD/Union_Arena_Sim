"use strict";
// ============================================================================
// Union Arena Digital — GameEngine (Batch 5.5)
// ============================================================================
// 门面类 — 封装所有子系统，提供统一的游戏初始化和操作入口。
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const GameState_1 = require("./GameState");
const EventBus_1 = require("./EventBus");
const TurnManager_1 = require("./TurnManager");
const RuleValidator_1 = require("./RuleValidator");
const ActionSystem_1 = require("./ActionSystem");
const CardSystem_1 = require("../systems/CardSystem");
const EnergySystem_1 = require("../systems/EnergySystem");
const AbilitySystem_1 = require("../systems/AbilitySystem");
const RaidSystem_1 = require("../systems/RaidSystem");
const BattleSystem_1 = require("../systems/BattleSystem");
const DamageSystem_1 = require("../systems/DamageSystem");
const TriggerSystem_1 = require("../systems/TriggerSystem");
class GameEngine {
    /**
     * 创建新游戏。
     */
    newGame(config) {
        // Expand keywords
        const expandedCards = config.cardDataList.map((c) => CardSystem_1.CardSystem.expandKeywords(c, config.keywordDefs));
        // Build registry
        this.cardRegistry = CardSystem_1.CardSystem.createRegistry(expandedCards);
        this.eventBus = new EventBus_1.EventBus();
        this.turnManager = new TurnManager_1.TurnManager(this.eventBus);
        this.energySystem = new EnergySystem_1.EnergySystem();
        this.abilitySystem = new AbilitySystem_1.AbilitySystem(this.eventBus);
        this.damageSystem = new DamageSystem_1.DamageSystem();
        this.triggerSystem = new TriggerSystem_1.TriggerSystem(this.abilitySystem);
        this.battleSystem = new BattleSystem_1.BattleSystem(this.eventBus, this.abilitySystem, this.damageSystem, this.triggerSystem);
        this.raidSystem = new RaidSystem_1.RaidSystem();
        this.ruleValidator = new RuleValidator_1.RuleValidator(this.energySystem);
        this.actionSystem = new ActionSystem_1.ActionSystem(this.eventBus, this.ruleValidator, this.abilitySystem, this.energySystem, this.raidSystem, (cardId) => this.cardRegistry.byId.get(cardId));
        // Create decks
        const allCards = this.cardRegistry.all;
        const deck1 = this.buildDeck(allCards, 50);
        const deck2 = this.buildDeck(allCards, 50);
        this.state = (0, GameState_1.createGameState)({
            gameId: config.gameId,
            playerOneId: config.playerOneId,
            playerTwoId: config.playerTwoId,
            deck1,
            deck2,
        });
        return this.state;
    }
    /**
     * 推进阶段。
     */
    advancePhase() {
        const { newState, events } = this.turnManager.advancePhase(this.state);
        this.state = newState;
        return { success: true, newState, events, log: [`Phase: ${newState.phase}`] };
    }
    /**
     * 提交玩家操作。
     */
    submitAction(action) {
        const result = this.actionSystem.submitAction(this.state, action);
        if (result.success) {
            this.state = result.newState;
        }
        return result;
    }
    /**
     * 获取当前状态（只读）。
     */
    getState() {
        return this.state;
    }
    /**
     * 获取 CardRegistry。
     */
    getCardRegistry() {
        return this.cardRegistry;
    }
    /**
     * 攻击宣言（BattleSystem 集成）。
     */
    declareAttack(attackerInstanceId, targetType, targetInstanceId) {
        const result = this.battleSystem.declareAttack(this.state, attackerInstanceId, targetType, targetInstanceId, (id) => this.cardRegistry.byId.get(id));
        this.state = result.newState;
        return { success: true, newState: result.newState, events: result.events, log: result.log };
    }
    /**
     * 阻挡宣言。
     */
    declareBlock(blockerInstanceId) {
        const result = this.battleSystem.declareBlock(this.state, blockerInstanceId);
        this.state = result.newState;
        return { success: true, newState: result.newState, events: result.events, log: result.log };
    }
    /**
     * 跳过阻挡（防御方选择不阻挡）。
     */
    skipBlock() {
        const result = this.battleSystem.skipBlock(this.state, (id) => this.cardRegistry.byId.get(id));
        this.state = result.newState;
        return { success: true, newState: result.newState, events: result.events, log: result.log };
    }
    /**
     * 获取当前战斗状态。
     */
    getBattleState() {
        return this.state.battleState;
    }
    // ==========================================================================
    // Helpers
    // ==========================================================================
    buildDeck(allCards, count) {
        const deck = [];
        const nameCounts = {};
        let i = 0;
        while (deck.length < count && i < count * 4) {
            const template = allCards[i % allCards.length];
            const cnt = nameCounts[template.cardId] || 0;
            if (cnt < 4) {
                nameCounts[template.cardId] = cnt + 1;
                deck.push({ ...template });
            }
            i++;
        }
        return deck;
    }
}
exports.GameEngine = GameEngine;
//# sourceMappingURL=GameEngine.js.map