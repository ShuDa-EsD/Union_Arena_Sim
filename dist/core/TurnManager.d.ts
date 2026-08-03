import { GameState, GamePhase, GameEvent } from './types';
import { EventBus } from './EventBus';
export declare class TurnManager {
    private eventBus;
    constructor(eventBus: EventBus);
    /**
     * 判断当前状态下是否允许进入 Attack Phase。
     * RQ-008: Player One Turn 1 不能进入 Attack Phase。
     */
    canEnterAttackPhase(state: GameState): boolean;
    /**
     * 获取下一阶段（不修改状态）。
     */
    getNextPhase(state: GameState): GamePhase;
    /**
     * 推进到下一阶段。返回新的 GameState 和触发的事件。
     * 自动执行阶段的入口/出口动作。
     */
    advancePhase(state: GameState): {
        newState: GameState;
        events: GameEvent[];
    };
    private executeStartPhase;
    private executeEndPhase;
    private switchToNextPlayer;
    private setPhase;
    private createEvent;
    private createPhaseEvent;
}
//# sourceMappingURL=TurnManager.d.ts.map