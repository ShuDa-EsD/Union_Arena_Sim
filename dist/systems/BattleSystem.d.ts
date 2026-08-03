import { GameState, GameEvent, CardData } from '../core/types';
import { EventBus } from '../core/EventBus';
import { AbilitySystem } from './AbilitySystem';
import { DamageSystem } from './DamageSystem';
import { TriggerSystem } from './TriggerSystem';
export declare class BattleSystem {
    private eventBus;
    private abilitySystem;
    private damageSystem;
    private triggerSystem;
    private attackedThisTurn;
    constructor(eventBus: EventBus, abilitySystem: AbilitySystem, damageSystem: DamageSystem, triggerSystem: TriggerSystem);
    /**
     * 检查是否可以开始新的攻击宣言。
     */
    canDeclareAttack(state: GameState): boolean;
    /**
     * 攻击宣言。
     */
    declareAttack(state: GameState, attackerInstanceId: string, targetType: 'Player' | 'Character', targetCharacterInstanceId?: string, getCardData?: (cardId: string) => CardData | undefined): {
        newState: GameState;
        events: GameEvent[];
        log: string[];
    };
    /**
     * 阻挡宣言。
     */
    declareBlock(state: GameState, blockerInstanceId: string): {
        newState: GameState;
        events: GameEvent[];
        log: string[];
    };
    /**
     * 跳过阻挡（防御方选择不阻挡）。
     */
    skipBlock(state: GameState, getCardData?: (cardId: string) => CardData | undefined): {
        newState: GameState;
        events: GameEvent[];
        log: string[];
    };
    /**
     * 战斗结算（BP 比较 + 伤害 + Trigger）。
     */
    resolveBattle(state: GameState, getCardData?: (cardId: string) => CardData | undefined): {
        newState: GameState;
        events: GameEvent[];
        log: string[];
    };
    /**
     * 战斗结束处理。
     */
    private endBattle;
    private findAttacker;
    private findBlocker;
    private findCharacterOwner;
    private getCardIdFromInstance;
    private hasSnipeAbility;
    private checkImpact;
}
//# sourceMappingURL=BattleSystem.d.ts.map