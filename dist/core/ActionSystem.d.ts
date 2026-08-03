import { GameState, ActionRequest, ActionResult, CardData } from './types';
import { EventBus } from './EventBus';
import { RuleValidator } from './RuleValidator';
import { AbilitySystem } from '../systems/AbilitySystem';
import { EnergySystem } from '../systems/EnergySystem';
import { RaidSystem } from '../systems/RaidSystem';
export declare class ActionSystem {
    private eventBus;
    private ruleValidator;
    private abilitySystem;
    private energySystem;
    private raidSystem;
    private getCardData;
    constructor(eventBus: EventBus, ruleValidator: RuleValidator, abilitySystem: AbilitySystem, energySystem: EnergySystem, raidSystem: RaidSystem, getCardData: (cardId: string) => CardData | undefined);
    /**
     * 接收并处理操作请求。
     */
    submitAction(state: GameState, action: ActionRequest): ActionResult;
    private handlePlayCharacter;
    private handlePlaySite;
    private handleUseEvent;
    private handleActivateAbility;
    private handlePerformRaid;
    private handleEndPhase;
    private handleExtraDraw;
    private getCardByInstance;
    private getCardIdFromInstance;
    private checkWinCondition;
}
//# sourceMappingURL=ActionSystem.d.ts.map