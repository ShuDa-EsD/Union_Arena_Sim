"use strict";
// ============================================================================
// Union Arena Digital — RuleValidator (Batch 2)
// ============================================================================
// 集中化的规则合法性检查。
// B2 实现：阶段权限 + 能量/AP 检查。
// B3+ 扩展：目标选择、状态条件、能力发动条件、战斗规则。
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleValidator = void 0;
const EnergySystem_1 = require("../systems/EnergySystem");
class RuleValidator {
    constructor(energySystem) {
        this.energySystem = energySystem || new EnergySystem_1.EnergySystem();
    }
    /**
     * 阶段权限矩阵。
     */
    isActionAllowedInPhase(action, phase) {
        switch (phase) {
            case 'Setup':
                return action === 'MulliganDecision';
            case 'Start':
                return action === 'ExtraDraw';
            case 'Movement':
                return action === 'MoveCharacter';
            case 'Main':
                return (action === 'PlayCharacter' ||
                    action === 'PlaySite' ||
                    action === 'UseEvent' ||
                    action === 'PerformRaid' ||
                    action === 'ActivateAbility' ||
                    action === 'EndMainPhase');
            case 'Attack':
                return (action === 'DeclareAttack' ||
                    action === 'DeclareBlock' ||
                    action === 'ActivateTrigger' ||
                    action === 'EndAttackPhase');
            case 'End':
                // End Phase 自动流转，无玩家操作
                return false;
            case 'GameOver':
                return false;
            default:
                return false;
        }
    }
    /**
     * 验证操作请求（B2 基础版 — 阶段权限 + 能量/AP）。
     */
    validateAction(state, action, playerId, options) {
        // 1. 阶段权限
        if (!this.isActionAllowedInPhase(action, state.phase)) {
            return {
                valid: false,
                error: `Action '${action}' is not allowed in phase '${state.phase}'`,
            };
        }
        // 2. 是否为当前玩家
        if (state.currentPlayerId !== playerId) {
            return { valid: false, error: 'Not your turn' };
        }
        // 3. 能量检查（仅对"打出卡牌"类操作 — 场上卡牌发动能力不需要再付能量）
        const isCardPlayAction = [
            'PlayCharacter', 'PlaySite', 'UseEvent', 'PerformRaid',
        ].includes(action);
        if (isCardPlayAction && options?.cardData && options?.getCardData) {
            if (!this.energySystem.canAfford(state, playerId, options.cardData, options.getCardData)) {
                const pool = this.energySystem.calculateEnergyWithRegistry(state, playerId, options.getCardData);
                return {
                    valid: false,
                    error: `Not enough energy. Required: ${options.cardData.requiredEnergy.color}×${options.cardData.requiredEnergy.amount}, Available: ${this.energySystem.describeEnergy(pool)}`,
                };
            }
        }
        // 4. AP 检查（仅对"打出卡牌"类操作 — 能力发动的 AP 代价由 AbilitySystem 处理）
        if (isCardPlayAction && options?.cardData) {
            if (!this.canPayAP(state, playerId, options.cardData.apCost)) {
                return {
                    valid: false,
                    error: `Not enough AP. Required: ${options.cardData.apCost}, Available: ${state.players[playerId]?.availableAP ?? 0}`,
                };
            }
        }
        return { valid: true };
    }
    /**
     * 验证 AP 是否足够。
     */
    canPayAP(state, playerId, apCost) {
        const player = state.players[playerId];
        if (!player)
            return false;
        return player.availableAP >= apCost;
    }
    /**
     * 验证能量是否足够。
     */
    canPayEnergy(state, playerId, card, getCardData) {
        return this.energySystem.canAfford(state, playerId, card, getCardData);
    }
    /**
     * 验证区域容量。
     */
    canPlaceInZone(state, playerId, zone) {
        const player = state.players[playerId];
        if (!player)
            return false;
        switch (zone) {
            case 'FrontLine':
                return player.frontLine.length < 4;
            case 'EnergyLine':
                return player.energyLine.length < 4;
            default:
                return true;
        }
    }
}
exports.RuleValidator = RuleValidator;
//# sourceMappingURL=RuleValidator.js.map