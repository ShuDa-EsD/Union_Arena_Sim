import { GameState, ActionType, GamePhase, CardData } from '../core/types';
import { EnergySystem } from '../systems/EnergySystem';
export declare class RuleValidator {
    private energySystem;
    constructor(energySystem?: EnergySystem);
    /**
     * 阶段权限矩阵。
     */
    isActionAllowedInPhase(action: ActionType, phase: GamePhase): boolean;
    /**
     * 验证操作请求（B2 基础版 — 阶段权限 + 能量/AP）。
     */
    validateAction(state: GameState, action: ActionType, playerId: string, options?: {
        cardData?: CardData;
        getCardData?: (cardId: string) => CardData | undefined;
    }): {
        valid: boolean;
        error?: string;
    };
    /**
     * 验证 AP 是否足够。
     */
    canPayAP(state: GameState, playerId: string, apCost: number): boolean;
    /**
     * 验证能量是否足够。
     */
    canPayEnergy(state: GameState, playerId: string, card: CardData, getCardData: (cardId: string) => CardData | undefined): boolean;
    /**
     * 验证区域容量。
     */
    canPlaceInZone(state: GameState, playerId: string, zone: string): boolean;
}
//# sourceMappingURL=RuleValidator.d.ts.map