import { GameState, GameEvent, CardInZone, CardData, AbilityData } from '../core/types';
import { AbilitySystem } from './AbilitySystem';
export declare class TriggerSystem {
    private abilitySystem;
    constructor(abilitySystem: AbilitySystem);
    /**
     * 检查一张生命卡是否有 Trigger 能力。
     */
    hasTrigger(card: CardInZone, getCardData: (cardId: string) => CardData | undefined): boolean;
    /**
     * 获取 Trigger 能力数据。
     */
    getTriggerAbility(card: CardInZone, getCardData: (cardId: string) => CardData | undefined): AbilityData | null;
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
    processTriggers(state: GameState, lifeCards: CardInZone[], targetPlayerId: string, getCardData: (cardId: string) => CardData | undefined): {
        newState: GameState;
        events: GameEvent[];
        log: string[];
    };
}
//# sourceMappingURL=TriggerSystem.d.ts.map