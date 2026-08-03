// ============================================================================
// Union Arena Digital — AbilitySystem (Batch 3)
// ============================================================================
// 能力触发检测、条件评估、代价支付、效果执行、同时发动队列。
//
// B3 支持的能力时机：WhenPlayed / ActivateMain
// B3 支持的效果类型：DrawCard / BPBuff / SwitchToActive / SwitchToResting /
//                    SidelineCharacter / Sequence
// B3 支持的条件：IfOnFrontLine / IfActive / IfOpponentHasCharacter / And / Or / Not
// B3 支持的代价：SwitchToResting / PayAp / SidelineThisCard / DiscardFromHand
//
// B4+ 扩展更多 timing / effect / condition / cost。
// ============================================================================

import {
  GameState, GameEvent, GameEventType, StateChange,
  AbilityData, AbilityInstance, CardData, CardInZone, CardOnField,
} from '../core/types';
import { applyChanges, getOpponentId } from '../core/GameState';
import { EventBus } from '../core/EventBus';

// ============================================================================
// Types
// ============================================================================

export interface ResolutionResult {
  success: boolean;
  newState: GameState;
  events: GameEvent[];
  log: string[];
}

interface AbilityContext {
  sourceCardInstanceId: string;
  sourcePlayerId: string;
  sourceCard: CardOnField | CardInZone;
  triggeringEvent: GameEvent;
}

// ============================================================================
// Timing → Event 映射
// ============================================================================

const TIMING_EVENT_MAP: Record<string, GameEventType[]> = {
  'WhenPlayed': ['CardPlayed'],
  'WhenSidelined': ['CardSidelined'],
  'WhenAttacking': ['AttackDeclared'],
  'WhenBlocking': ['BlockDeclared'],
  'WhenBattleWins': ['BattleWon'],
  'WhenBattleLoses': ['BattleLost'],
  'StartOfTurn': ['TurnStarted'],
  'EndOfTurn': ['TurnEnded'],
  'StartOfAttackPhase': ['PhaseChanged'], // + phase check
};

export class AbilitySystem {
  constructor(private eventBus: EventBus) {}

  // ==========================================================================
  // TriggerDetector
  // ==========================================================================

  /**
   * 扫描场上所有卡牌，找到匹配触发事件的能力。
   */
  detectTriggeredAbilities(
    state: GameState,
    event: GameEvent,
  ): AbilityInstance[] {
    const result: AbilityInstance[] = [];

    for (const [, player] of Object.entries(state.players)) {
      const fieldCards: CardOnField[] = [...player.frontLine, ...player.energyLine];

      for (const card of fieldCards) {
        // 从 CardRegistry 获取能力数据 — 这里需要外部传入 getCardData
        // B3 暂时通过 cardId 关联（调用方负责注入）
      }
    }

    return result;
  }

  /**
   * 使用 CardRegistry 查找能力。
   */
  detectTriggeredAbilitiesWithRegistry(
    state: GameState,
    event: GameEvent,
    getCardData: (cardId: string) => CardData | undefined,
  ): AbilityInstance[] {
    const result: AbilityInstance[] = [];
    let instanceCounter = 0;

    for (const [, player] of Object.entries(state.players)) {
      const fieldCards: CardOnField[] = [...player.frontLine, ...player.energyLine];

      for (const card of fieldCards) {
        const cardData = getCardData(card.cardId);
        if (!cardData) continue;

        const allAbilities = [...cardData.abilities];

        // 检查 Trigger
        if (cardData.trigger && this.matchesTriggerEvent(event)) {
          allAbilities.push(cardData.trigger);
        }

        for (const ability of allAbilities) {
          if (this.matchesTiming(event.eventType, ability.timing)) {
            // 检查条件
            const context: AbilityContext = {
              sourceCardInstanceId: card.instanceId,
              sourcePlayerId: card.ownerId,
              sourceCard: card,
              triggeringEvent: event,
            };

            if (this.evaluateCondition(ability.condition, state, context)) {
              result.push({
                instanceId: `abl-inst-${++instanceCounter}-${card.instanceId}`,
                abilityData: ability,
                sourceCardInstanceId: card.instanceId,
                sourcePlayerId: card.ownerId,
                isTrigger: ability === cardData.trigger,
              });
            }
          }
        }
      }
    }

    return result;
  }

  private matchesTiming(eventType: GameEventType, timing: string): boolean {
    const mapped = TIMING_EVENT_MAP[timing];
    if (mapped) return mapped.includes(eventType);

    // PhaseChanged 特殊处理：匹配 data.newPhase
    // B3: StartOfAttackPhase needs PHASE_CHANGED + newPhase=Attack
    return false;
  }

  private matchesTriggerEvent(event: GameEvent): boolean {
    return event.eventType === 'LifeCardRevealed';
  }

  // ==========================================================================
  // ConditionEvaluator
  // ==========================================================================

  evaluateCondition(
    condition: Record<string, any> | undefined,
    state: GameState,
    context: AbilityContext,
  ): boolean {
    if (!condition) return true;

    const type = condition.conditionType as string;

    switch (type) {
      case 'IfOnFrontLine': {
        const player = state.players[context.sourcePlayerId];
        return player.frontLine.some((c) => c.instanceId === context.sourceCardInstanceId);
      }

      case 'IfActive': {
        const card = context.sourceCard as CardOnField;
        return card.state === 'Active';
      }

      case 'IfOpponentHasCharacter': {
        const opponentId = getOpponentId(state, context.sourcePlayerId);
        return state.players[opponentId].frontLine.length > 0;
      }

      case 'And': {
        const subs: Record<string, any>[] = condition.subConditions || [];
        return subs.every((c) => this.evaluateCondition(c, state, context));
      }

      case 'Or': {
        const subs: Record<string, any>[] = condition.subConditions || [];
        return subs.some((c) => this.evaluateCondition(c, state, context));
      }

      case 'Not': {
        const sub: Record<string, any> | undefined = condition.subCondition;
        return !this.evaluateCondition(sub, state, context);
      }

      default:
        // Unknown condition — B4+ 扩展
        return true;
    }
  }

  // ==========================================================================
  // CostPayer
  // ==========================================================================

  /**
   * 检查所有代价是否可支付（不修改状态）。
   * 返回 null 表示不可支付。
   */
  checkCosts(
    costs: Array<{ costType: string; params?: Record<string, any> }>,
    state: GameState,
    context: AbilityContext,
  ): boolean {
    for (const cost of costs) {
      if (!this.checkSingleCost(cost, state, context)) return false;
    }
    return true;
  }

  /**
   * 生成代价支付的 StateChange 列表。
   * 调用方应确保已通过 checkCosts 验证。
   */
  payCosts(
    costs: Array<{ costType: string; params?: Record<string, any> }>,
    state: GameState,
    context: AbilityContext,
  ): StateChange[] {
    const changes: StateChange[] = [];

    for (const cost of costs) {
      const c = this.paySingleCost(cost, state, context);
      if (c) changes.push(...c);
    }

    return changes;
  }

  private checkSingleCost(
    cost: { costType: string; params?: Record<string, any> },
    state: GameState,
    context: AbilityContext,
  ): boolean {
    const player = state.players[context.sourcePlayerId];

    switch (cost.costType) {
      case 'SwitchToResting': {
        const card = context.sourceCard as CardOnField;
        return card.state === 'Active';
      }
      case 'PayAp': {
        const amount = cost.params?.amount || 1;
        return player.availableAP >= amount;
      }
      case 'SidelineThisCard':
        return true; // Always possible
      case 'DiscardFromHand': {
        const amount = cost.params?.amount || 1;
        return player.hand.length >= amount;
      }
      default:
        return true; // Unknown cost — assume possible (B4+ 扩展)
    }
  }

  private paySingleCost(
    cost: { costType: string; params?: Record<string, any> },
    _state: GameState,
    context: AbilityContext,
  ): StateChange[] | null {
    const playerId = context.sourcePlayerId;

    switch (cost.costType) {
      case 'SwitchToResting':
        return [{
          type: 'SET_FIELD_STATE',
          instanceId: context.sourceCardInstanceId,
          state: 'Resting',
          playerId,
        }];

      case 'PayAp': {
        const amount = cost.params?.amount || 1;
        return [{ type: 'ADJUST_AP', playerId, delta: -amount }];
      }

      case 'SidelineThisCard':
        return [{
          type: 'MOVE_CARD',
          instanceId: context.sourceCardInstanceId,
          from: 'FrontLine' as any, // Will be resolved by the caller
          to: 'Sideline',
          playerId,
        }];

      case 'DiscardFromHand': {
        const amount = cost.params?.amount || 1;
        const changes: StateChange[] = [];
        // Generic: discard last N cards from hand
        const player = _state.players[playerId];
        for (let i = 0; i < amount; i++) {
          const card = player.hand[player.hand.length - 1 - i];
          if (card) {
            changes.push({
              type: 'MOVE_CARD',
              instanceId: card.instanceId,
              from: 'Hand',
              to: 'Sideline',
              playerId,
            });
          }
        }
        return changes;
      }

      default:
        return null;
    }
  }

  // ==========================================================================
  // EffectExecutor
  // ==========================================================================

  /**
   * 执行效果列表，返回 StateChange + 产生的事件。
   */
  executeEffects(
    effects: Array<{ effectType: string; params?: Record<string, any> }>,
    state: GameState,
    context: AbilityContext,
    getCardData: (cardId: string) => CardData | undefined,
  ): { changes: StateChange[]; events: GameEvent[] } {
    const allChanges: StateChange[] = [];
    const allEvents: GameEvent[] = [];

    for (const effect of effects) {
      const result = this.executeSingleEffect(effect, state, context, getCardData);
      allChanges.push(...result.changes);
      allEvents.push(...result.events);
    }

    return { changes: allChanges, events: allEvents };
  }

  private executeSingleEffect(
    effect: { effectType: string; params?: Record<string, any> },
    state: GameState,
    context: AbilityContext,
    _getCardData: (cardId: string) => CardData | undefined,
  ): { changes: StateChange[]; events: GameEvent[] } {
    const playerId = context.sourcePlayerId;
    const changes: StateChange[] = [];
    const events: GameEvent[] = [];

    switch (effect.effectType) {
      case 'DrawCard': {
        const count = effect.params?.count || 1;
        changes.push({ type: 'DRAW_CARD', playerId, count });
        break;
      }

      case 'BpBuff': {
        const amount = effect.params?.amount || 0;
        const targetId = effect.params?.target || context.sourceCardInstanceId;
        changes.push({ type: 'UPDATE_BP', instanceId: targetId, delta: amount, playerId });
        break;
      }

      case 'SwitchToActive': {
        const targetId = effect.params?.target || context.sourceCardInstanceId;
        changes.push({ type: 'SET_FIELD_STATE', instanceId: targetId, state: 'Active', playerId });
        break;
      }

      case 'SwitchToResting': {
        const targetId = effect.params?.target || context.sourceCardInstanceId;
        changes.push({ type: 'SET_FIELD_STATE', instanceId: targetId, state: 'Resting', playerId });
        break;
      }

      case 'SidelineCharacter': {
        const targetId = effect.params?.target;
        if (targetId) {
          changes.push({ type: 'MOVE_CARD', instanceId: targetId, from: 'FrontLine', to: 'Sideline', playerId: state.players[context.sourcePlayerId].frontLine.find(c => c.instanceId === targetId)?.ownerId || playerId });
        }
        break;
      }

      case 'Sequence': {
        const subEffects = effect.params?.effects || [];
        for (const sub of subEffects) {
          const subResult = this.executeSingleEffect(sub, state, context, _getCardData);
          changes.push(...subResult.changes);
          events.push(...subResult.events);
        }
        break;
      }

      default:
        // Unknown effect — B4+ 扩展
        break;
    }

    return { changes, events };
  }

  // ==========================================================================
  // AbilityQueue
  // ==========================================================================

  /**
   * 结算能力队列。
   * 规则：回合玩家能力优先 → 非回合玩家能力随后。
   * RQ-009 默认策略 B：新触发能力保持归属优先级。
   */
  resolveQueue(
    state: GameState,
    queue: AbilityInstance[],
    getCardData: (cardId: string) => CardData | undefined,
  ): ResolutionResult {
    if (queue.length === 0) {
      return { success: true, newState: state, events: [], log: [] };
    }

    const log: string[] = [];
    const allEvents: GameEvent[] = [];
    let workingState = state;

    // 排序：回合玩家 → 非回合玩家
    const turnPlayer = state.currentPlayerId;
    const turnPlayerAbilities = queue.filter((a) => a.sourcePlayerId === turnPlayer);
    const otherAbilities = queue.filter((a) => a.sourcePlayerId !== turnPlayer);
    const ordered = [...turnPlayerAbilities, ...otherAbilities];

    for (const ability of ordered) {
      const card = this.findCardAnywhere(workingState, ability.sourceCardInstanceId);
      if (!card) {
        log.push(`Ability ${ability.abilityData.abilityId}: source card not found, skipped`);
        continue;
      }

      const context: AbilityContext = {
        sourceCardInstanceId: ability.sourceCardInstanceId,
        sourcePlayerId: ability.sourcePlayerId,
        sourceCard: card as CardOnField,
        triggeringEvent: {
          eventType: 'AbilityActivated',
          sourcePlayerId: ability.sourcePlayerId,
          sourceCardInstanceId: ability.sourceCardInstanceId,
          data: { abilityId: ability.abilityData.abilityId },
        },
      };

      // 条件复查
      if (!this.evaluateCondition(ability.abilityData.condition, workingState, context)) {
        log.push(`Ability ${ability.abilityData.abilityId}: condition no longer met`);
        continue;
      }

      // 检查代价
      if (!this.checkCosts(ability.abilityData.costs, workingState, context)) {
        log.push(`Ability ${ability.abilityData.abilityId}: costs cannot be paid`);
        continue;
      }

      // 支付代价
      const costChanges = this.payCosts(ability.abilityData.costs, workingState, context);
      if (costChanges.length > 0) {
        workingState = applyChanges(workingState, costChanges);
        if (workingState.stateVersion === state.stateVersion && costChanges.length > 0) {
          log.push(`Ability ${ability.abilityData.abilityId}: cost payment failed`);
          continue;
        }
      }

      // 执行效果
      const effectResult = this.executeEffects(
        ability.abilityData.effects,
        workingState,
        context,
        getCardData,
      );

      if (effectResult.changes.length > 0) {
        workingState = applyChanges(workingState, effectResult.changes);
      }

      allEvents.push(...effectResult.events);

      // Emit ability resolved
      const resolvedEvent: GameEvent = {
        eventType: 'AbilityResolved',
        sourcePlayerId: ability.sourcePlayerId,
        sourceCardInstanceId: ability.sourceCardInstanceId,
        data: { abilityId: ability.abilityData.abilityId },
      };
      allEvents.push(resolvedEvent);
      this.eventBus.emit(resolvedEvent);

      log.push(`Ability ${ability.abilityData.abilityId}: resolved`);

      // 效果产生的新事件可能触发新能力 → MVP B3 简化：不递归
      // 完整递归检测在 B4 加入
    }

    return { success: true, newState: workingState, events: allEvents, log };
  }

  // ==========================================================================
  // Activate: Main 手动发动
  // ==========================================================================

  /**
   * 手动发动 Activate: Main 能力。
   */
  activateAbility(
    state: GameState,
    playerId: string,
    cardInstanceId: string,
    abilityId: string,
    getCardData: (cardId: string) => CardData | undefined,
  ): ResolutionResult {
    const card = this.findCardOnField(state, cardInstanceId);
    if (!card) {
      return { success: false, newState: state, events: [], log: ['Card not on field'] };
    }

    const cardData = getCardData(card.cardId);
    if (!cardData) {
      return { success: false, newState: state, events: [], log: ['Card data not found'] };
    }

    const ability = cardData.abilities.find((a) => a.abilityId === abilityId);
    if (!ability) {
      return { success: false, newState: state, events: [], log: ['Ability not found'] };
    }

    if (ability.timing !== 'ActivateMain') {
      return { success: false, newState: state, events: [], log: ['Ability is not Activate: Main'] };
    }

    const instance: AbilityInstance = {
      instanceId: `manual-${abilityId}-${cardInstanceId}`,
      abilityData: ability,
      sourceCardInstanceId: cardInstanceId,
      sourcePlayerId: playerId,
      isTrigger: false,
    };

    return this.resolveQueue(state, [instance], getCardData);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private findCardOnField(state: GameState, instanceId: string): CardOnField | null {
    for (const [, player] of Object.entries(state.players)) {
      for (const zone of [player.frontLine, player.energyLine, player.apArea]) {
        const found = zone.find((c) => c.instanceId === instanceId);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * 在任意区域查找卡牌（包括 Sideline/LifeArea — Trigger 能力需要）。
   */
  private findCardAnywhere(state: GameState, instanceId: string): CardInZone | null {
    for (const [, player] of Object.entries(state.players)) {
      for (const zone of [player.frontLine, player.energyLine, player.apArea, player.hand, player.deck, player.lifeArea, player.sideline, player.removalArea]) {
        const found = zone.find((c) => c.instanceId === instanceId);
        if (found) return found;
      }
    }
    return null;
  }
}
