import { GameState, StateChange, CardInZone } from '../core/types';
export interface DamageResult {
    changes: StateChange[];
    lifeCardsRevealed: CardInZone[];
}
export declare class DamageSystem {
    /**
     * 计算一次攻击的伤害点数。
     * 基础 = 1
     * Damage 2 关键词 → 2（显式能力：SetDamageMultiplier）
     * Damage +1 → +1（显式能力：ModifyDamage +1）
     *
     * B4: 从攻击者的 abilities 中查找伤害修正效果。
     * 调用方（BattleSystem）负责从 CardData 提取伤害相关能力。
     */
    calculateDamage(damageModifiers: {
        base?: number;
        multiplier?: number;
        bonus?: number;
    }): number;
    /**
     * 对目标玩家造成伤害。
     * 返回 StateChange（生命卡翻开）+ 被翻开的卡牌列表（供 TriggerSystem 处理）。
     *
     * 攻击方选择生命卡（简化：从末尾开始选）。
     */
    dealDamage(state: GameState, targetPlayerId: string, amount: number, _sourcePlayerId: string): DamageResult;
    /**
     * 提取卡牌的伤害修正参数。
     */
    extractDamageModifiers(abilityEffects: Array<{
        effectType: string;
        params?: Record<string, any>;
    }>): {
        multiplier?: number;
        bonus?: number;
    };
}
//# sourceMappingURL=DamageSystem.d.ts.map