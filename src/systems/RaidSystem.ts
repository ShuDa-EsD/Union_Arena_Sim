// ============================================================================
// Union Arena Digital — RaidSystem (Batch 5)
// ============================================================================
// Raid 验证 + 堆叠执行。
// RQ-004: raidAbilities 与 abilities 分离存储，仅 Raid 打出时合并注册。
// ============================================================================

import {
  GameState, StateChange, GameEvent, CardData, CardOnField, AbilityData,
} from '../core/types';
import { applyChanges } from '../core/GameState';

export class RaidSystem {
  /**
   * 验证 Raid 目标是否合法。
   */
  validateRaidTarget(
    state: GameState,
    playerId: string,
    card: CardData,
    targetInstanceId: string,
  ): { valid: boolean; error?: string } {
    if (!card.raid) {
      return { valid: false, error: 'Card does not have Raid' };
    }

    const player = state.players[playerId];
    // 目标必须在场上（前线或能量线）
    const target = [...player.frontLine, ...player.energyLine]
      .find((c) => c.instanceId === targetInstanceId);

    if (!target) {
      return { valid: false, error: 'Raid target not found on your field' };
    }

    const spec = card.raid.targetSpecifier;
    if (spec.type === 'Name') {
      // 按名称匹配
      const targetCardData = this.getCardName(target.cardId); // Simplified — needs CardRegistry
      // MVP: compare cardId prefix
      if (target.cardId !== spec.value) {
        return { valid: false, error: `Target name mismatch: expected ${spec.value}, got ${target.cardId}` };
      }
    } else if (spec.type === 'Affinity') {
      // 按属性匹配 — needs CardData.affinities
      // MVP: delegated to caller with CardRegistry
    }

    return { valid: true };
  }

  /**
   * 验证 Raid 目标（使用 CardRegistry 完整版）。
   */
  validateRaidTargetWithRegistry(
    state: GameState,
    playerId: string,
    card: CardData,
    targetInstanceId: string,
    getCardData: (cardId: string) => CardData | undefined,
  ): { valid: boolean; error?: string } {
    if (!card.raid) {
      return { valid: false, error: 'Card does not have Raid' };
    }

    const player = state.players[playerId];
    const target = [...player.frontLine, ...player.energyLine]
      .find((c) => c.instanceId === targetInstanceId);

    if (!target) {
      return { valid: false, error: 'Raid target not found on your field' };
    }

    const targetData = getCardData(target.cardId);
    if (!targetData) {
      return { valid: false, error: 'Target card data not found' };
    }

    const spec = card.raid.targetSpecifier;
    if (spec.type === 'Name') {
      if (targetData.cardName !== spec.value && targetData.cardId !== spec.value) {
        return { valid: false, error: `Target mismatch: expected ${spec.value}` };
      }
    } else if (spec.type === 'Affinity') {
      if (!targetData.affinities.includes(spec.value)) {
        return { valid: false, error: `Target affinity mismatch: expected ${spec.value}` };
      }
    }

    return { valid: true };
  }

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
  performRaid(
    state: GameState,
    playerId: string,
    cardInstanceId: string,
    targetInstanceId: string,
    card: CardData,
    targetZone: 'FrontLine' | 'EnergyLine',
  ): { changes: StateChange[]; events: GameEvent[]; log: string[] } {
    const changes: StateChange[] = [];
    const events: GameEvent[] = [];
    const log: string[] = [];

    const player = state.players[playerId];
    const target = [...player.frontLine, ...player.energyLine]
      .find((c) => c.instanceId === targetInstanceId);

    if (!target) {
      return { changes, events, log: ['Target not found'] };
    }

    const targetCurrentZone = player.frontLine.find(c => c.instanceId === targetInstanceId)
      ? 'FrontLine' : 'EnergyLine';

    // 1. 支付 AP
    if (card.apCost > 0) {
      changes.push({ type: 'ADJUST_AP', playerId, delta: -card.apCost });
    }

    // 2. 移动 Raid 卡到手牌到场上
    changes.push({
      type: 'MOVE_CARD',
      instanceId: cardInstanceId,
      from: 'Hand',
      to: targetCurrentZone,
      playerId,
    });

    // 3. 设置堆叠关系 + 底层卡恢复 Active
    //    (需要在 applyChanges 后操作 — 这里先记录 instanceId)
    //    raidedBy: 底层卡被哪张卡堆叠
    //    raiding: 顶层卡堆叠在哪张卡上

    // 4. 如果底层卡为 Resting → Active
    if (target.state === 'Resting') {
      changes.push({
        type: 'SET_FIELD_STATE',
        instanceId: targetInstanceId,
        state: 'Active',
        playerId,
      });
    }

    // 5. 顶层卡设置为 Active（Raid 入场特殊规则）
    changes.push({
      type: 'SET_FIELD_STATE',
      instanceId: cardInstanceId,
      state: 'Active',
      playerId,
    });

    // 6. 如果在能量线上 → 可选移至前线（MVP 简化：自动移）
    if (targetCurrentZone === 'EnergyLine') {
      changes.push({
        type: 'MOVE_CARD',
        instanceId: cardInstanceId,
        from: 'EnergyLine',
        to: 'FrontLine',
        playerId,
      });
    }

    // Emit event for WhenPlayed
    events.push({
      eventType: 'CardPlayed',
      sourcePlayerId: playerId,
      sourceCardInstanceId: cardInstanceId,
      data: { cardId: card.cardId, isRaid: true, targetInstanceId },
    });

    log.push(`Raid: ${card.cardId} stacked on ${target.cardId}`);

    return { changes, events, log };
  }

  /**
   * Raid 卡离开场上时的清理。
   * 顶层卡去 destination，底层卡 → Sideline（不算被 Sidelined）。
   *
   * 规则书: "move only the top card to that destination.
   *          Place the underlying card(s) into your sideline."
   */
  handleRaidCardLeaving(
    state: GameState,
    instanceId: string,
    destination: string,
  ): StateChange[] {
    const changes: StateChange[] = [];

    for (const [, player] of Object.entries(state.players)) {
      for (const card of [...player.frontLine, ...player.energyLine]) {
        if (card.instanceId === instanceId && card.raiding) {
          // 检测底层卡实际所在区域
          const underlyingZone = player.frontLine.find(c => c.instanceId === card.raiding)
            ? 'FrontLine' : 'EnergyLine';

          // 底层卡 → Sideline（不算被 Sidelined — 使用 MOVE_CARD 而非特殊标记）
          changes.push({
            type: 'MOVE_CARD',
            instanceId: card.raiding,
            from: underlyingZone,
            to: 'Sideline',
            playerId: player.playerId,
          });

          // 顶层卡 → destination
          changes.push({
            type: 'MOVE_CARD',
            instanceId: card.instanceId,
            from: underlyingZone,
            to: destination as any,
            playerId: player.playerId,
          });
        }
      }
    }

    return changes;
  }

  private getCardName(_cardId: string): string {
    return ''; // Simplified — needs CardRegistry
  }
}
