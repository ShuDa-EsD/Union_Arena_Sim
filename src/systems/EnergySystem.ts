// ============================================================================
// Union Arena Digital — EnergySystem (Batch 2)
// ============================================================================
// 能量汇总 + canAfford + 能量消耗追踪。
// ============================================================================

import { GameState, CardData } from '../core/types';

export class EnergySystem {
  /**
   * 计算某玩家的当前能量池（按颜色汇总）。
   * 遍历能量线上的所有卡牌，累加 energyGeneration。
   * 前线卡牌不参与能量计算。
   */
  calculateEnergy(state: GameState, playerId: string): Record<string, number> {
    const player = state.players[playerId];
    if (!player) return {};

    const pool: Record<string, number> = {};

    for (const card of player.energyLine) {
      // 需要 CardData 获取 energyGeneration，但运行时只有 cardId
      // 在实际集成中需要 CardRegistry。此处使用 cardId 作为 fallback 查询。
      // B2 简化：从卡牌实例的 cardId 推断（需要 CardRegistry 集成）。
      // 完整实现在 GameEngine 集成时通过 CardRegistry 查找。
    }

    return pool;
  }

  /**
   * 计算能量池（需要 CardRegistry 提供卡牌数据）。
   * 遍历能量线，从 registry 查找每张卡的 energyGeneration。
   */
  calculateEnergyWithRegistry(
    state: GameState,
    playerId: string,
    getCardData: (cardId: string) => CardData | undefined,
  ): Record<string, number> {
    const player = state.players[playerId];
    if (!player) return {};

    const pool: Record<string, number> = {};

    for (const card of player.energyLine) {
      const cardData = getCardData(card.cardId);
      if (cardData && cardData.energyGeneration) {
        for (const gen of cardData.energyGeneration) {
          pool[gen.color] = (pool[gen.color] || 0) + gen.amount;
        }
      }
    }

    return pool;
  }

  /**
   * 判断某玩家能否支付某张卡的能量需求。
   */
  canAfford(
    state: GameState,
    playerId: string,
    card: CardData,
    getCardData: (cardId: string) => CardData | undefined,
  ): boolean {
    const pool = this.calculateEnergyWithRegistry(state, playerId, getCardData);
    const required = card.requiredEnergy;
    return (pool[required.color] || 0) >= required.amount;
  }

  /**
   * 获取能量池的文本描述（用于日志/调试）。
   */
  describeEnergy(pool: Record<string, number>): string {
    const entries = Object.entries(pool).filter(([, v]) => v > 0);
    if (entries.length === 0) return '0 energy';
    return entries.map(([color, amount]) => `${color}×${amount}`).join(', ');
  }
}
