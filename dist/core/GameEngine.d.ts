import { GameState, ActionRequest, ActionResult, CardData, CardRegistry } from './types';
export interface GameConfig {
    gameId: string;
    playerOneId: string;
    playerTwoId: string;
    cardDataList: CardData[];
    keywordDefs: Map<string, import('./types').AbilityData[]>;
}
export declare class GameEngine {
    private state;
    private eventBus;
    private turnManager;
    private ruleValidator;
    private actionSystem;
    private energySystem;
    private abilitySystem;
    private raidSystem;
    private battleSystem;
    private damageSystem;
    private triggerSystem;
    private cardRegistry;
    /**
     * 创建新游戏。
     */
    newGame(config: GameConfig): GameState;
    /**
     * 推进阶段。
     */
    advancePhase(): ActionResult;
    /**
     * 提交玩家操作。
     */
    submitAction(action: ActionRequest): ActionResult;
    /**
     * 获取当前状态（只读）。
     */
    getState(): GameState;
    /**
     * 获取 CardRegistry。
     */
    getCardRegistry(): CardRegistry;
    /**
     * 攻击宣言（BattleSystem 集成）。
     */
    declareAttack(attackerInstanceId: string, targetType: 'Player' | 'Character', targetInstanceId?: string): ActionResult;
    /**
     * 阻挡宣言。
     */
    declareBlock(blockerInstanceId: string): ActionResult;
    /**
     * 跳过阻挡（防御方选择不阻挡）。
     */
    skipBlock(): ActionResult;
    /**
     * 获取当前战斗状态。
     */
    getBattleState(): import("./types").BattleState | null;
    private buildDeck;
}
//# sourceMappingURL=GameEngine.d.ts.map