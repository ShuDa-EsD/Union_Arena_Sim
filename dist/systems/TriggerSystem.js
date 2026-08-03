"use strict";
// ============================================================================
// Union Arena Digital — TriggerSystem (Batch 4)
// ============================================================================
// Trigger 检查 + 可选发动 + 多 Trigger 顺序管理。
// 职责边界：只负责 Trigger 流程控制，Trigger 能力的效果结算委托给 AbilitySystem。
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerSystem = void 0;
class TriggerSystem {
    constructor(abilitySystem) {
        this.abilitySystem = abilitySystem;
    }
    /**
     * 检查一张生命卡是否有 Trigger 能力。
     */
    hasTrigger(card, getCardData) {
        const cardData = getCardData(card.cardId);
        return !!(cardData && cardData.trigger);
    }
    /**
     * 获取 Trigger 能力数据。
     */
    getTriggerAbility(card, getCardData) {
        const cardData = getCardData(card.cardId);
        return cardData?.trigger || null;
    }
    /**
     * 处理多点伤害的 Trigger 结算。
     *
     * 流程（每张 Trigger 卡）：
     * 1. 翻开 → 检查 Trigger
     * 2. 有 Trigger → 防御方选择是否发动
     * 3. 发动 → 结算能力 → Sideline
     *    不发动 → 直接 Sideline
     * 4. 无 Trigger → 直接 Sideline
     *
     * MVP 简化：Trigger 自动发动（不询问玩家选择），
     * 多 Trigger 按生命卡翻开顺序结算。
     */
    processTriggers(state, lifeCards, targetPlayerId, getCardData) {
        let workingState = state;
        const events = [];
        const log = [];
        for (const card of lifeCards) {
            const cardData = getCardData(card.cardId);
            if (cardData?.trigger) {
                // 有 Trigger — MVP 自动发动
                events.push({
                    eventType: 'TriggerChecked',
                    sourcePlayerId: targetPlayerId,
                    data: { cardId: card.cardId, instanceId: card.instanceId },
                });
                const instance = {
                    instanceId: `trigger-${card.instanceId}`,
                    abilityData: cardData.trigger,
                    sourceCardInstanceId: card.instanceId,
                    sourcePlayerId: targetPlayerId,
                    isTrigger: true,
                };
                const result = this.abilitySystem.resolveQueue(workingState, [instance], getCardData);
                workingState = result.newState;
                events.push(...result.events);
                log.push(`Trigger: ${cardData.cardId} activated`);
                events.push({
                    eventType: 'TriggerActivated',
                    sourcePlayerId: targetPlayerId,
                    data: { cardId: card.cardId },
                });
            }
            else {
                // 无 Trigger — 直接 Sideline
                log.push(`No trigger on ${card.cardId}, moved to Sideline`);
            }
            // 卡已通过 DamageSystem.dealDamage 的 MOVE_CARD 移到 Sideline
            // （DamageSystem 先执行 MOVE_CARD，TriggerSystem 只处理能力结算）
        }
        return { newState: workingState, events, log };
    }
}
exports.TriggerSystem = TriggerSystem;
//# sourceMappingURL=TriggerSystem.js.map