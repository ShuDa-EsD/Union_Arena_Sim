import { GameState, StateChange, Zone } from '../core/types';
export declare class MovementSystem {
    /**
     * 验证移动合法性。
     */
    canMove(state: GameState, playerId: string, instanceId: string, from: Zone, to: Zone): {
        valid: boolean;
        error?: string;
    };
    /**
     * 执行角色移动。
     * 目标满 4 张时：为要移入的角色移除目标线 1 张卡（进 Sideline）。
     */
    moveCharacter(state: GameState, playerId: string, instanceId: string, from: Zone, to: Zone): StateChange[];
}
//# sourceMappingURL=MovementSystem.d.ts.map