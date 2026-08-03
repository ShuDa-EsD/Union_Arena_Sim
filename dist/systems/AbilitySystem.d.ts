import { GameState, GameEvent, StateChange, AbilityInstance, CardData, CardInZone, CardOnField } from '../core/types';
import { EventBus } from '../core/EventBus';
export interface ResolutionResult {
    success: boolean;
    newState: GameState;
    events: GameEvent[];
    log: string[];
}
interface AbilityContext {
    sourceCardInstanceId: string;
    sourcePlayerId: string;
    sourceCard: CardOnField | CardInZone;
    triggeringEvent: GameEvent;
}
export declare class AbilitySystem {
    private eventBus;
    constructor(eventBus: EventBus);
    /**
     * 扫描场上所有卡牌，找到匹配触发事件的能力。
     */
    detectTriggeredAbilities(state: GameState, event: GameEvent): AbilityInstance[];
    /**
     * 使用 CardRegistry 查找能力。
     */
    detectTriggeredAbilitiesWithRegistry(state: GameState, event: GameEvent, getCardData: (cardId: string) => CardData | undefined): AbilityInstance[];
    private matchesTiming;
    private matchesTriggerEvent;
    evaluateCondition(condition: Record<string, any> | undefined, state: GameState, context: AbilityContext): boolean;
    /**
     * 检查所有代价是否可支付（不修改状态）。
     * 返回 null 表示不可支付。
     */
    checkCosts(costs: Array<{
        costType: string;
        params?: Record<string, any>;
    }>, state: GameState, context: AbilityContext): boolean;
    /**
     * 生成代价支付的 StateChange 列表。
     * 调用方应确保已通过 checkCosts 验证。
     */
    payCosts(costs: Array<{
        costType: string;
        params?: Record<string, any>;
    }>, state: GameState, context: AbilityContext): StateChange[];
    private checkSingleCost;
    private paySingleCost;
    /**
     * 执行效果列表，返回 StateChange + 产生的事件。
     */
    executeEffects(effects: Array<{
        effectType: string;
        params?: Record<string, any>;
    }>, state: GameState, context: AbilityContext, getCardData: (cardId: string) => CardData | undefined): {
        changes: StateChange[];
        events: GameEvent[];
    };
    private executeSingleEffect;
    /**
     * 结算能力队列。
     * 规则：回合玩家能力优先 → 非回合玩家能力随后。
     * RQ-009 默认策略 B：新触发能力保持归属优先级。
     */
    resolveQueue(state: GameState, queue: AbilityInstance[], getCardData: (cardId: string) => CardData | undefined): ResolutionResult;
    /**
     * 手动发动 Activate: Main 能力。
     */
    activateAbility(state: GameState, playerId: string, cardInstanceId: string, abilityId: string, getCardData: (cardId: string) => CardData | undefined): ResolutionResult;
    private findCardOnField;
    /**
     * 在任意区域查找卡牌（包括 Sideline/LifeArea — Trigger 能力需要）。
     */
    private findCardAnywhere;
}
export {};
//# sourceMappingURL=AbilitySystem.d.ts.map