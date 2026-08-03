// ============================================================================
// Union Arena Digital — TriggerSystem (Batch 4)
// ============================================================================
// Trigger 检查 + 可选发动 + 多 Trigger 顺序管理。
// 职责边界：只负责 Trigger 流程控制，Trigger 能力的效果结算委托给 AbilitySystem。
// ============================================================================

import {
  GameState, StateChange, GameEvent, CardInZone,
  CardData, AbilityInstance, AbilityData,
} from '../core/types';
import { applyChanges } from '../core/GameState';
import { AbilitySystem } from './AbilitySystem';

export class TriggerSystem {
  constructor(private abilitySystem: AbilitySystem) {}

  /**
   * 检查一张生命卡是否有 Trigger 能力。
   */
  hasTrigger(card: CardInZone, getCardData: (cardId: string) => CardData | undefined): boolean {
    const cardData = getCardData(card.cardId);
    return !!(cardData && cardData.trigger);
  }

  /**
   * 获取 Trigger 能力数据。
   */
  getTriggerAbility(card: CardInZone, getCardData: (cardId: string) => CardData | undefined): AbilityData | null {
    const cardData = getCardData(card.cardId);
    return cardData?.trigger || null;
  }

  /**
   * 处理多点伤害的 Trigger 结算。
   *
   * 流程（每张 Trigger 卡）：
   * 1. 翻开 → 检查 Trigger
   * 2. 有 Trigger → 防御方选择是否发动
   * 3. 发动 → 结算能力 → Sideline
   *    不发动 → 直接 Sideline
   * 4. 无 Trigger → 直接 Sideline
   *
   * MVP 简化：Trigger 自动发动（不询问玩家选择），
   * 多 Trigger 按生命卡翻开顺序结算。
   */
  processTriggers(
    state: GameState,
    lifeCards: CardInZone[],
    targetPlayerId: string,
    getCardData: (cardId: string) => CardData | undefined,
  ): { newState: GameState; events: GameEvent[]; log: string[] } {
    let workingState = state;
    const events: GameEvent[] = [];
    const log: string[] = [];

    for (const card of lifeCards) {
      const cardData = getCardData(card.cardId);

      if (cardData?.trigger) {
        // 有 Trigger — MVP 自动发动
        events.push({
          eventType: 'TriggerChecked',
          sourcePlayerId: targetPlayerId,
          data: { cardId: card.cardId, instanceId: card.instanceId },
        });

        const instance: AbilityInstance = {
          instanceId: `trigger-${card.instanceId}`,
          abilityData: cardData.trigger,
          sourceCardInstanceId: card.instanceId,
          sourcePlayerId: targetPlayerId,
          isTrigger: true,
        };

        const result = this.abilitySystem.resolveQueue(workingState, [instance], getCardData);
        workingState = result.newState;
        events.push(...result.events);
        log.push(`Trigger: ${cardData.cardId} activated`);

        events.push({
          eventType: 'TriggerActivated',
          sourcePlayerId: targetPlayerId,
          data: { cardId: card.cardId },
        });
      } else {
        // 无 Trigger — 直接 Sideline
        log.push(`No trigger on ${card.cardId}, moved to Sideline`);
      }

      // 卡已通过 DamageSystem.dealDamage 的 MOVE_CARD 移到 Sideline
      // （DamageSystem 先执行 MOVE_CARD，TriggerSystem 只处理能力结算）
    }

    return { newState: workingState, events, log };
  }
}
