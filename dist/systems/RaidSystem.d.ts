import { GameState, StateChange, GameEvent, CardData } from '../core/types';
export declare class RaidSystem {
    /**
     * 验证 Raid 目标是否合法。
     */
    validateRaidTarget(state: GameState, playerId: string, card: CardData, targetInstanceId: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * 验证 Raid 目标（使用 CardRegistry 完整版）。
     */
    validateRaidTargetWithRegistry(state: GameState, playerId: string, card: CardData, targetInstanceId: string, getCardData: (cardId: string) => CardData | undefined): {
        valid: boolean;
        error?: string;
    };
    /**
     * 执行 Raid。
     *
     * 流程 (RQ-004):
     * 1. 验证目标
     * 2. 支付 AP
     * 3. 堆叠新卡在目标上（raiding/raidedBy 关系）
     * 4. 底层卡能力失效（通过 raidedBy 标记实现）
     * 5. 底层卡为 Resting → 切换为 Active
     * 6. 在能量线上 → 可选移至前线
     * 7. 注册 abilities + raidAbilities（RQ-004：合并注册，仅 Raid 时）
     */
    performRaid(state: GameState, playerId: string, cardInstanceId: string, targetInstanceId: string, card: CardData, targetZone: 'FrontLine' | 'EnergyLine'): {
        changes: StateChange[];
        events: GameEvent[];
        log: string[];
    };
    /**
     * Raid 卡离开场上时的清理。
     * 顶层卡去 destination，底层卡 → Sideline（不算被 Sidelined）。
     *
     * 规则书: "move only the top card to that destination.
     *          Place the underlying card(s) into your sideline."
     */
    handleRaidCardLeaving(state: GameState, instanceId: string, destination: string): StateChange[];
    private getCardName;
}
//# sourceMappingURL=RaidSystem.d.ts.map