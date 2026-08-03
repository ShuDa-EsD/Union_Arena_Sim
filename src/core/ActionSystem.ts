// ============================================================================
// Union Arena Digital — ActionSystem (Batch 3)
// ============================================================================
// 接收操作请求 → RuleValidator 验证 → 执行 → 更新 GameState → 返回结果。
// B3 支持：PlayCharacter / PlaySite / UseEvent / ActivateAbility / EndMainPhase / EndAttackPhase
// ============================================================================

import {
  GameState, StateChange, ActionRequest, ActionResult,
  GameEvent, CardData, Zone,
} from './types';
import { applyChanges, getOpponentId } from './GameState';
import { EventBus } from './EventBus';
import { RuleValidator } from './RuleValidator';
import { AbilitySystem } from '../systems/AbilitySystem';
import { EnergySystem } from '../systems/EnergySystem';
import { RaidSystem } from '../systems/RaidSystem';

export class ActionSystem {
  constructor(
    private eventBus: EventBus,
    private ruleValidator: RuleValidator,
    private abilitySystem: AbilitySystem,
    private energySystem: EnergySystem,
    private raidSystem: RaidSystem,
    private getCardData: (cardId: string) => CardData | undefined,
  ) {}

  /**
   * 接收并处理操作请求。
   */
  submitAction(state: GameState, action: ActionRequest): ActionResult {
    // 1. 规则验证
    const cardId = action.cardInstanceId
      ? this.getCardIdFromInstance(state, action.cardInstanceId)
      : undefined;
    const cardData = cardId ? this.getCardData(cardId) : undefined;

    const validation = this.ruleValidator.validateAction(
      state,
      action.actionType,
      action.playerId,
      {
        cardData,
        getCardData: this.getCardData,
      },
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        newState: state,
        events: [],
        log: [validation.error || 'Validation failed'],
      };
    }

    // 2. 分发执行
    switch (action.actionType) {
      case 'PlayCharacter':
        return this.handlePlayCharacter(state, action);
      case 'PlaySite':
        return this.handlePlaySite(state, action);
      case 'UseEvent':
        return this.handleUseEvent(state, action);
      case 'PerformRaid':
        return this.handlePerformRaid(state, action);
      case 'ActivateAbility':
        return this.handleActivateAbility(state, action);
      case 'EndMainPhase':
        return this.handleEndPhase(state, action, 'Attack');
      case 'EndAttackPhase':
        return this.handleEndPhase(state, action, 'End');
      case 'ExtraDraw':
        return this.handleExtraDraw(state, action);
      default:
        return {
          success: false,
          error: `Action '${action.actionType}' not yet implemented (B4+)`,
          newState: state,
          events: [],
          log: [],
        };
    }
  }

  // ==========================================================================
  // Play Character
  // ==========================================================================

  private handlePlayCharacter(state: GameState, action: ActionRequest): ActionResult {
    const playerId = action.playerId;
    const cardInstanceId = action.cardInstanceId!;
    const targetZone: Zone = action.targetZone || 'FrontLine';
    const cardData = this.getCardByInstance(state, cardInstanceId);

    if (!cardData || cardData.cardType !== 'Character') {
      return { success: false, error: 'Not a character card', newState: state, events: [], log: [] };
    }

    const changes: StateChange[] = [];
    const events: GameEvent[] = [];
    const log: string[] = [];

    // 1. 支付 AP
    if (cardData.apCost > 0) {
      changes.push({ type: 'ADJUST_AP', playerId, delta: -cardData.apCost });
    }

    // 2. 手牌 → 场上
    changes.push({
      type: 'MOVE_CARD',
      instanceId: cardInstanceId,
      from: 'Hand',
      to: targetZone,
      playerId,
    });

    // 3. 设置 BP（Character 卡牌）
    if (cardData.bp) {
      changes.push({
        type: 'UPDATE_BP',
        instanceId: cardInstanceId,
        delta: cardData.bp.base,
        playerId,
      });
    }

    // 4. 设置为 Resting (step number adjusted for BP addition above)
    changes.push({
      type: 'SET_FIELD_STATE',
      instanceId: cardInstanceId,
      state: 'Resting',
      playerId,
    });

    let workingState = applyChanges(state, changes);

    // 4. 检查容量超限（如果目标线满4张，需要移除1张）
    const player = workingState.players[playerId];
    const targetArray = targetZone === 'FrontLine' ? player.frontLine : player.energyLine;
    if (targetArray.length > 4) {
      const toRemove = targetArray[0]; // 移除最早加入的
      workingState = applyChanges(workingState, [{
        type: 'MOVE_CARD',
        instanceId: toRemove.instanceId,
        from: targetZone,
        to: 'Sideline',
        playerId,
      }]);
      log.push(`Zone full: removed ${toRemove.instanceId} to Sideline`);
    }

    // 5. 发射 CARD_PLAYED 事件
    const cardPlayedEvent: GameEvent = {
      eventType: 'CardPlayed',
      sourcePlayerId: playerId,
      sourceCardInstanceId: cardInstanceId,
      data: { cardId: cardData.cardId, targetZone },
    };
    events.push(cardPlayedEvent);
    this.eventBus.emit(cardPlayedEvent);

    // 6. 检测 WhenPlayed 能力
    const triggered = this.abilitySystem.detectTriggeredAbilitiesWithRegistry(
      workingState,
      cardPlayedEvent,
      this.getCardData,
    );

    if (triggered.length > 0) {
      const resolution = this.abilitySystem.resolveQueue(workingState, triggered, this.getCardData);
      workingState = resolution.newState;
      events.push(...resolution.events);
      log.push(...resolution.log);
    }

    // 7. 检查胜利条件
    const winner = this.checkWinCondition(workingState);
    if (winner) {
      workingState = { ...workingState, winner, phase: 'GameOver' as const };
      events.push({
        eventType: 'GameEnded',
        data: { winner },
      });
    }

    return { success: true, newState: workingState, events, log };
  }

  // ==========================================================================
  // Play Site
  // ==========================================================================

  private handlePlaySite(state: GameState, action: ActionRequest): ActionResult {
    const playerId = action.playerId;
    const cardInstanceId = action.cardInstanceId!;
    const cardData = this.getCardByInstance(state, cardInstanceId);

    if (!cardData || cardData.cardType !== 'Site') {
      return { success: false, error: 'Not a site card', newState: state, events: [], log: [] };
    }

    const changes: StateChange[] = [];

    if (cardData.apCost > 0) {
      changes.push({ type: 'ADJUST_AP', playerId, delta: -cardData.apCost });
    }

    changes.push({ type: 'MOVE_CARD', instanceId: cardInstanceId, from: 'Hand', to: 'EnergyLine', playerId });
    changes.push({ type: 'SET_FIELD_STATE', instanceId: cardInstanceId, state: 'Resting', playerId });

    let workingState = applyChanges(state, changes);

    const event: GameEvent = {
      eventType: 'CardPlayed',
      sourcePlayerId: playerId,
      sourceCardInstanceId: cardInstanceId,
      data: { cardId: cardData.cardId, targetZone: 'EnergyLine' },
    };
    this.eventBus.emit(event);

    return { success: true, newState: workingState, events: [event], log: [] };
  }

  // ==========================================================================
  // Use Event
  // ==========================================================================

  private handleUseEvent(state: GameState, action: ActionRequest): ActionResult {
    const playerId = action.playerId;
    const cardInstanceId = action.cardInstanceId!;
    const cardData = this.getCardByInstance(state, cardInstanceId);

    if (!cardData || cardData.cardType !== 'Event') {
      return { success: false, error: 'Not an event card', newState: state, events: [], log: [] };
    }

    const changes: StateChange[] = [];
    const events: GameEvent[] = [];
    const log: string[] = [];

    // Pay AP
    if (cardData.apCost > 0) {
      changes.push({ type: 'ADJUST_AP', playerId, delta: -cardData.apCost });
    }

    // Event resolves from hand → Sideline
    changes.push({ type: 'MOVE_CARD', instanceId: cardInstanceId, from: 'Hand', to: 'Sideline', playerId });

    let workingState = applyChanges(state, changes);

    // Execute the event's ability (Event cards use WhenPlayed timing)
    const eventAbilities = cardData.abilities.filter((a) => a.timing === 'WhenPlayed');
    if (eventAbilities.length > 0) {
      const context = {
        sourceCardInstanceId: cardInstanceId,
        sourcePlayerId: playerId,
        sourceCard: workingState.players[playerId].sideline.find((c) => c.instanceId === cardInstanceId) || workingState.players[playerId].hand[0],
        triggeringEvent: {
          eventType: 'CardPlayed' as const,
          sourcePlayerId: playerId,
          sourceCardInstanceId: cardInstanceId,
          data: { cardId: cardData.cardId },
        },
      };

      const effectResult = this.abilitySystem.executeEffects(
        eventAbilities.flatMap((a) => a.effects),
        workingState,
        { ...context, sourceCard: context.sourceCard as any },
        this.getCardData,
      );

      workingState = applyChanges(workingState, effectResult.changes);
      events.push(...effectResult.events);
    }

    return { success: true, newState: workingState, events, log };
  }

  // ==========================================================================
  // Activate Ability
  // ==========================================================================

  private handleActivateAbility(state: GameState, action: ActionRequest): ActionResult {
    const result = this.abilitySystem.activateAbility(
      state,
      action.playerId,
      action.cardInstanceId!,
      action.abilityId!,
      this.getCardData,
    );
    return result;
  }

  // ==========================================================================
  // Perform Raid
  // ==========================================================================

  private handlePerformRaid(state: GameState, action: ActionRequest): ActionResult {
    const playerId = action.playerId;
    const cardInstanceId = action.cardInstanceId!;
    const targetInstanceId = action.targetInstanceId!;
    const cardData = this.getCardByInstance(state, cardInstanceId);

    if (!cardData || cardData.cardType !== 'Character' || !cardData.raid) {
      return { success: false, error: 'Not a valid Raid card', newState: state, events: [], log: [] };
    }

    // Validate target
    const targetValidation = this.raidSystem.validateRaidTargetWithRegistry(
      state, playerId, cardData, targetInstanceId, this.getCardData,
    );
    if (!targetValidation.valid) {
      return { success: false, error: targetValidation.error, newState: state, events: [], log: [] };
    }

    // Execute Raid
    const raidResult = this.raidSystem.performRaid(
      state, playerId, cardInstanceId, targetInstanceId, cardData, 'FrontLine',
    );

    let workingState = applyChanges(state, raidResult.changes);

    // Handle stack relationships (raiding/raidedBy) — these are metadata not in StateChange
    const player = workingState.players[playerId];
    const topCard = [...player.frontLine, ...player.energyLine]
      .find((c) => c.instanceId === cardInstanceId);
    const bottomCard = [...player.frontLine, ...player.energyLine]
      .find((c) => c.instanceId === targetInstanceId);

    if (topCard && bottomCard) {
      topCard.raiding = targetInstanceId;
      bottomCard.raidedBy = cardInstanceId;
    }

    // RQ-004: Register abilities + raidAbilities (merged only on Raid)
    const mergedAbilities = [...cardData.abilities, ...(cardData.raid?.raidAbilities || [])];
    const cardPlayedEvent = raidResult.events.find((e) => e.eventType === 'CardPlayed');
    const events = [...raidResult.events];
    const log = [...raidResult.log];

    if (cardPlayedEvent) {
      this.eventBus.emit(cardPlayedEvent);

      // Detect WhenPlayed abilities using merged list
      const triggered = this.abilitySystem.detectTriggeredAbilitiesWithRegistry(
        workingState, cardPlayedEvent, this.getCardData,
      );
      // Also check raidAbilities for WhenPlayed
      if (cardData.raid?.raidAbilities) {
        for (const ra of cardData.raid.raidAbilities) {
          if (ra.timing === 'WhenPlayed') {
            triggered.push({
              instanceId: `raid-abl-${ra.abilityId}-${cardInstanceId}`,
              abilityData: ra,
              sourceCardInstanceId: cardInstanceId,
              sourcePlayerId: playerId,
              isTrigger: false,
            });
          }
        }
      }

      if (triggered.length > 0) {
        const resolution = this.abilitySystem.resolveQueue(workingState, triggered, this.getCardData);
        workingState = resolution.newState;
        events.push(...resolution.events);
        log.push(...resolution.log);
      }
    }

    // Win check
    const winner = this.checkWinCondition(workingState);
    if (winner) {
      workingState = { ...workingState, winner, phase: 'GameOver' as const };
      events.push({ eventType: 'GameEnded', data: { winner } });
    }

    return { success: true, newState: workingState, events, log };
  }

  // ==========================================================================
  // End Phase (Main→Attack or Attack→End)
  // ==========================================================================

  private handleEndPhase(state: GameState, action: ActionRequest, _nextPhase: string): ActionResult {
    // Phase transitions are handled by TurnManager.advancePhase
    // This action just validates that the player wants to end the phase
    return {
      success: true,
      newState: state,
      events: [],
      log: ['Phase end requested — advance via TurnManager'],
    };
  }

  // ==========================================================================
  // Extra Draw
  // ==========================================================================

  private handleExtraDraw(state: GameState, action: ActionRequest): ActionResult {
    const playerId = action.playerId;
    const player = state.players[playerId];

    if (player.availableAP < 1) {
      return { success: false, error: 'Not enough AP for extra draw', newState: state, events: [], log: [] };
    }

    const changes: StateChange[] = [
      { type: 'ADJUST_AP', playerId, delta: -1 },
      { type: 'DRAW_CARD', playerId, count: 1 },
    ];

    const newState = applyChanges(state, changes);
    return { success: true, newState, events: [], log: ['Extra draw: paid 1AP, drew 1 card'] };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getCardByInstance(state: GameState, instanceId: string): CardData | undefined {
    const cardId = this.getCardIdFromInstance(state, instanceId);
    if (!cardId) return undefined;
    return this.getCardData(cardId);
  }

  private getCardIdFromInstance(state: GameState, instanceId: string): string | undefined {
    for (const [, player] of Object.entries(state.players)) {
      for (const zone of [player.hand, player.deck, player.frontLine, player.energyLine, player.lifeArea, player.sideline, player.removalArea]) {
        const found = zone.find((c) => c.instanceId === instanceId);
        if (found) return found.cardId;
      }
    }
    return undefined;
  }

  private checkWinCondition(state: GameState): string | null {
    for (const [playerId, playerState] of Object.entries(state.players)) {
      if (playerState.lifeArea.length === 0) {
        return getOpponentId(state, playerId);
      }
    }
    return null;
  }
}
