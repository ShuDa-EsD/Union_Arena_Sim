import { GameState, CardData } from '../core/types';
export declare class EnergySystem {
    /**
     * 计算某玩家的当前能量池（按颜色汇总）。
     * 遍历能量线上的所有卡牌，累加 energyGeneration。
     * 前线卡牌不参与能量计算。
     */
    calculateEnergy(state: GameState, playerId: string): Record<string, number>;
    /**
     * 计算能量池（需要 CardRegistry 提供卡牌数据）。
     * 遍历能量线，从 registry 查找每张卡的 energyGeneration。
     */
    calculateEnergyWithRegistry(state: GameState, playerId: string, getCardData: (cardId: string) => CardData | undefined): Record<string, number>;
    /**
     * 判断某玩家能否支付某张卡的能量需求。
     */
    canAfford(state: GameState, playerId: string, card: CardData, getCardData: (cardId: string) => CardData | undefined): boolean;
    /**
     * 获取能量池的文本描述（用于日志/调试）。
     */
    describeEnergy(pool: Record<string, number>): string;
}
//# sourceMappingURL=EnergySystem.d.ts.map