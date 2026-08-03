"use strict";
// ============================================================================
// Union Arena Digital — DamageSystem (Batch 4)
// ============================================================================
// 伤害计算 + 生命卡选择。
// 职责边界：只负责"多少伤害"和"选哪些生命卡"，不负责 Trigger 结算。
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DamageSystem = void 0;
class DamageSystem {
    /**
     * 计算一次攻击的伤害点数。
     * 基础 = 1
     * Damage 2 关键词 → 2（显式能力：SetDamageMultiplier）
     * Damage +1 → +1（显式能力：ModifyDamage +1）
     *
     * B4: 从攻击者的 abilities 中查找伤害修正效果。
     * 调用方（BattleSystem）负责从 CardData 提取伤害相关能力。
     */
    calculateDamage(damageModifiers) {
        let damage = damageModifiers.base ?? 1;
        if (damageModifiers.multiplier) {
            damage = damageModifiers.multiplier;
        }
        if (damageModifiers.bonus) {
            damage += damageModifiers.bonus;
        }
        return Math.max(1, damage);
    }
    /**
     * 对目标玩家造成伤害。
     * 返回 StateChange（生命卡翻开）+ 被翻开的卡牌列表（供 TriggerSystem 处理）。
     *
     * 攻击方选择生命卡（简化：从末尾开始选）。
     */
    dealDamage(state, targetPlayerId, amount, _sourcePlayerId) {
        const player = state.players[targetPlayerId];
        const changes = [];
        const revealed = [];
        const remaining = Math.min(amount, player.lifeArea.length);
        for (let i = 0; i < remaining; i++) {
            // 从末尾取生命卡（模拟攻击方选择 — MVP 简化：选最后一张）
            const card = player.lifeArea[player.lifeArea.length - 1 - i];
            if (card) {
                // 翻开生命卡
                changes.push({
                    type: 'MOVE_CARD',
                    instanceId: card.instanceId,
                    from: 'LifeArea',
                    to: 'Sideline', // 先移到 Sideline（Trigger 结算后的目的地）
                    playerId: targetPlayerId,
                });
                revealed.push({ ...card, faceUp: true });
            }
        }
        return { changes, lifeCardsRevealed: revealed };
    }
    /**
     * 提取卡牌的伤害修正参数。
     */
    extractDamageModifiers(abilityEffects) {
        const result = {};
        for (const effect of abilityEffects) {
            if (effect.effectType === 'SetDamageMultiplier') {
                result.multiplier = effect.params?.amount || 2;
            }
            if (effect.effectType === 'ModifyDamage') {
                result.bonus = (result.bonus || 0) + (effect.params?.amount || 1);
            }
        }
        return result;
    }
}
exports.DamageSystem = DamageSystem;
//# sourceMappingURL=DamageSystem.js.map