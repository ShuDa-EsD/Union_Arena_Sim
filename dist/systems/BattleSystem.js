"use strict";
// ============================================================================
// Union Arena Digital — BattleSystem (Batch 4)
// ============================================================================
// 攻击阶段完整流程：攻击宣言 → 阻挡宣言 → BP 结算 → 伤害 → Trigger → 结束。
//
// 职责边界：
//   - Battle 流程控制 → BattleSystem
//   - 伤害点数计算 → DamageSystem
//   - Trigger 检查结算 → TriggerSystem
//   - 能力触发（WhenAttacking/WhenBlocking/Impact等）→ AbilitySystem
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleSystem = void 0;
const GameState_1 = require("../core/GameState");
class BattleSystem {
    constructor(eventBus, abilitySystem, damageSystem, triggerSystem) {
        this.eventBus = eventBus;
        this.abilitySystem = abilitySystem;
        this.damageSystem = damageSystem;
        this.triggerSystem = triggerSystem;
        // Track which characters have attacked this turn (for Double Attack: IsFirstAttackThisTurn)
        this.attackedThisTurn = new Set();
        // Reset per-turn tracking on each new turn
        this.eventBus.on('TurnStarted', () => {
            this.attackedThisTurn.clear();
        });
    }
    // ==========================================================================
    // Attack Phase Lifecycle
    // ==========================================================================
    /**
     * 检查是否可以开始新的攻击宣言。
     */
    canDeclareAttack(state) {
        if (state.phase !== 'Attack')
            return false;
        if (!state.battleState)
            return true; // No active battle
        return state.battleState.step === 'Idle';
    }
    /**
     * 攻击宣言。
     */
    declareAttack(state, attackerInstanceId, targetType, targetCharacterInstanceId, getCardData) {
        const playerId = state.currentPlayerId;
        const player = state.players[playerId];
        const events = [];
        const log = [];
        // 查找攻击角色
        const attacker = player.frontLine.find((c) => c.instanceId === attackerInstanceId);
        if (!attacker || attacker.state !== 'Active') {
            return { newState: state, events, log: ['Attacker not found or not Active'] };
        }
        // 确定目标玩家
        const targetPlayerId = targetType === 'Player'
            ? (0, GameState_1.getOpponentId)(state, playerId)
            : (targetCharacterInstanceId
                ? this.findCharacterOwner(state, targetCharacterInstanceId)
                : (0, GameState_1.getOpponentId)(state, playerId));
        // 检查 Snipe
        const isSnipe = this.hasSnipeAbility(attacker, getCardData);
        // 创建 BattleState
        const battleState = {
            step: 'AttackerDeclaration',
            attacker: {
                cardInstanceId: attackerInstanceId,
                bpAtDeclaration: attacker.currentBP,
            },
            target: {
                type: targetType,
                playerId: targetPlayerId,
                characterInstanceId: targetCharacterInstanceId,
            },
            blocker: null,
            isSnipe,
            damageDealt: 0,
        };
        // 攻击角色 Active → Resting
        let workingState = (0, GameState_1.applyChanges)(state, [
            { type: 'SET_FIELD_STATE', instanceId: attackerInstanceId, state: 'Resting', playerId },
        ]);
        // Track first attack per turn (for Double Attack: IsFirstAttackThisTurn)
        const isFirstAttack = !this.attackedThisTurn.has(attackerInstanceId);
        this.attackedThisTurn.add(attackerInstanceId);
        workingState = { ...workingState, battleState };
        // Emit ATTACK_DECLARED
        const attackEvent = {
            eventType: 'AttackDeclared',
            sourcePlayerId: playerId,
            sourceCardInstanceId: attackerInstanceId,
            data: { targetType, targetPlayerId, isSnipe },
        };
        events.push(attackEvent);
        this.eventBus.emit(attackEvent);
        // WhenAttacking 能力
        if (getCardData) {
            const triggered = this.abilitySystem.detectTriggeredAbilitiesWithRegistry(workingState, attackEvent, getCardData);
            if (triggered.length > 0) {
                const result = this.abilitySystem.resolveQueue(workingState, triggered, getCardData);
                workingState = { ...result.newState, battleState: workingState.battleState };
                events.push(...result.events);
                log.push(...result.log);
            }
        }
        // Snipe → 跳过阻挡，直接进入结算
        if (isSnipe) {
            workingState = {
                ...workingState,
                battleState: { ...workingState.battleState, step: 'Resolving' },
            };
            return this.resolveBattle(workingState, getCardData);
        }
        // 进入阻挡宣言阶段
        workingState = {
            ...workingState,
            battleState: { ...workingState.battleState, step: 'BlockerDeclaration' },
        };
        return { newState: workingState, events, log };
    }
    /**
     * 阻挡宣言。
     */
    declareBlock(state, blockerInstanceId) {
        const events = [];
        const log = [];
        if (!state.battleState || state.battleState.step !== 'BlockerDeclaration') {
            return { newState: state, events, log: ['Cannot block now'] };
        }
        const defenderId = (0, GameState_1.getOpponentId)(state, state.currentPlayerId);
        const defender = state.players[defenderId];
        const blocker = defender.frontLine.find((c) => c.instanceId === blockerInstanceId);
        if (!blocker || blocker.state !== 'Active') {
            return { newState: state, events, log: ['Blocker not found or not Active'] };
        }
        // Blocker Active → Resting
        let workingState = (0, GameState_1.applyChanges)(state, [
            { type: 'SET_FIELD_STATE', instanceId: blockerInstanceId, state: 'Resting', playerId: defenderId },
        ]);
        workingState = {
            ...workingState,
            battleState: {
                ...workingState.battleState,
                step: 'Resolving',
                blocker: {
                    cardInstanceId: blockerInstanceId,
                    bpAtDeclaration: blocker.currentBP,
                },
            },
        };
        // Emit BLOCK_DECLARED
        const blockEvent = {
            eventType: 'BlockDeclared',
            sourcePlayerId: defenderId,
            sourceCardInstanceId: blockerInstanceId,
            data: {},
        };
        events.push(blockEvent);
        this.eventBus.emit(blockEvent);
        return { newState: workingState, events, log };
    }
    /**
     * 跳过阻挡（防御方选择不阻挡）。
     */
    skipBlock(state, getCardData) {
        if (!state.battleState || state.battleState.step !== 'BlockerDeclaration') {
            return { newState: state, events: [], log: ['Cannot skip block now'] };
        }
        // 进入结算阶段
        const workingState = {
            ...state,
            battleState: { ...state.battleState, step: 'Resolving' },
        };
        return this.resolveBattle(workingState, getCardData);
    }
    /**
     * 战斗结算（BP 比较 + 伤害 + Trigger）。
     */
    resolveBattle(state, getCardData) {
        const bs = state.battleState;
        if (!bs || bs.step !== 'Resolving') {
            return { newState: state, events: [], log: ['Not in resolving step'] };
        }
        const events = [];
        const log = [];
        let workingState = state;
        const attacker = this.findAttacker(workingState, bs.attacker.cardInstanceId);
        if (!attacker) {
            return { newState: workingState, events, log: ['Attacker not found'] };
        }
        // ================================================================
        // 分支A: 有阻挡（角色 vs 角色）— BP 比较
        // ================================================================
        if (bs.blocker) {
            const blocker = this.findBlocker(workingState, bs.blocker.cardInstanceId);
            if (!blocker) {
                return { newState: workingState, events, log: ['Blocker not found'] };
            }
            if (attacker.currentBP >= blocker.currentBP) {
                // 攻方胜 → 阻挡角色 Sideline
                log.push(`Battle: attacker wins (${attacker.currentBP} >= ${blocker.currentBP})`);
                const blockerOwner = blocker.ownerId;
                workingState = (0, GameState_1.applyChanges)(workingState, [
                    { type: 'MOVE_CARD', instanceId: blocker.instanceId, from: 'FrontLine', to: 'Sideline', playerId: blockerOwner },
                ]);
                events.push({
                    eventType: 'BattleWon',
                    sourcePlayerId: state.currentPlayerId,
                    sourceCardInstanceId: attacker.instanceId,
                    data: { attackerBP: attacker.currentBP, blockerBP: blocker.currentBP },
                });
                // Impact 结算
                if (getCardData) {
                    const impactDamage = this.checkImpact(attacker, getCardData);
                    if (impactDamage > 0) {
                        const dmgResult = this.damageSystem.dealDamage(workingState, (0, GameState_1.getOpponentId)(workingState, state.currentPlayerId), impactDamage, state.currentPlayerId);
                        workingState = (0, GameState_1.applyChanges)(workingState, dmgResult.changes);
                        bs.damageDealt += impactDamage;
                        // Trigger 处理
                        const trigResult = this.triggerSystem.processTriggers(workingState, dmgResult.lifeCardsRevealed, (0, GameState_1.getOpponentId)(workingState, state.currentPlayerId), getCardData);
                        workingState = trigResult.newState;
                        events.push(...trigResult.events);
                        log.push(...trigResult.log);
                    }
                }
            }
            else {
                // 攻方败
                log.push(`Battle: attacker loses (${attacker.currentBP} < ${blocker.currentBP})`);
                events.push({
                    eventType: 'BattleLost',
                    sourcePlayerId: state.currentPlayerId,
                    sourceCardInstanceId: attacker.instanceId,
                    data: { attackerBP: attacker.currentBP, blockerBP: blocker.currentBP },
                });
            }
        }
        else {
            // ================================================================
            // 分支B: 无阻挡（角色 vs 玩家）— 直接伤害
            // ================================================================
            log.push('Battle: unblocked — direct damage');
            // WhenNotBlocked 能力
            if (getCardData) {
                const notBlockedEvent = {
                    eventType: 'BattleResolved',
                    sourcePlayerId: state.currentPlayerId,
                    sourceCardInstanceId: attacker.instanceId,
                    data: { blocked: false },
                };
                const triggered = this.abilitySystem.detectTriggeredAbilitiesWithRegistry(workingState, notBlockedEvent, getCardData);
                if (triggered.length > 0) {
                    const result = this.abilitySystem.resolveQueue(workingState, triggered, getCardData);
                    workingState = result.newState;
                    events.push(...result.events);
                }
            }
            // 计算伤害
            const dmgModifiers = getCardData
                ? this.damageSystem.extractDamageModifiers(getCardData(this.getCardIdFromInstance(workingState, attacker.instanceId) || '')?.abilities.flatMap(a => a.effects) || [])
                : {};
            const damage = this.damageSystem.calculateDamage(dmgModifiers);
            // 造成伤害
            const targetPlayerId = (0, GameState_1.getOpponentId)(workingState, state.currentPlayerId);
            const dmgResult = this.damageSystem.dealDamage(workingState, targetPlayerId, damage, state.currentPlayerId);
            workingState = (0, GameState_1.applyChanges)(workingState, dmgResult.changes);
            bs.damageDealt += damage;
            // Trigger 处理
            const trigResult = this.triggerSystem.processTriggers(workingState, dmgResult.lifeCardsRevealed, targetPlayerId, getCardData || (() => undefined));
            workingState = trigResult.newState;
            events.push(...trigResult.events);
            log.push(...trigResult.log);
        }
        // ================================================================
        // 战斗结束
        // ================================================================
        return this.endBattle(workingState, events, log, getCardData);
    }
    /**
     * 战斗结束处理。
     */
    endBattle(state, events, log, getCardData) {
        let workingState = { ...state, battleState: { ...state.battleState, step: 'Ending' } };
        // Double Attack: 首次攻击结束后恢复 Active (IsFirstAttackThisTurn)
        const attackerInstanceId = workingState.battleState.attacker.cardInstanceId;
        const isFirstAttackThisTurn = !this.attackedThisTurn.has(attackerInstanceId + '-done');
        if (getCardData) {
            const attacker = this.findAttacker(workingState, attackerInstanceId);
            if (attacker && isFirstAttackThisTurn) {
                const cardData = getCardData(this.getCardIdFromInstance(workingState, attacker.instanceId) || '');
                const hasDoubleAttack = cardData?.abilities.some((a) => a.effects.some((e) => e.effectType === 'DoubleAttack'));
                if (hasDoubleAttack) {
                    workingState = (0, GameState_1.applyChanges)(workingState, [
                        { type: 'SET_FIELD_STATE', instanceId: attacker.instanceId, state: 'Active', playerId: attacker.ownerId },
                    ]);
                    log.push('Double Attack: attacker restored to Active');
                }
            }
        }
        // Mark attack complete so Double Attack doesn't trigger again
        this.attackedThisTurn.add(attackerInstanceId + '-done');
        events.push({
            eventType: 'BattleResolved',
            data: { damageDealt: workingState.battleState.damageDealt },
        });
        // 清除 BattleState
        workingState = { ...workingState, battleState: null };
        return { newState: workingState, events, log };
    }
    // ==========================================================================
    // Helpers
    // ==========================================================================
    findAttacker(state, instanceId) {
        for (const [, player] of Object.entries(state.players)) {
            const found = player.frontLine.find((c) => c.instanceId === instanceId);
            if (found)
                return found;
        }
        return null;
    }
    findBlocker(state, instanceId) {
        return this.findAttacker(state, instanceId);
    }
    findCharacterOwner(state, instanceId) {
        for (const [playerId, player] of Object.entries(state.players)) {
            if (player.frontLine.some((c) => c.instanceId === instanceId))
                return playerId;
        }
        return (0, GameState_1.getOpponentId)(state, state.currentPlayerId);
    }
    getCardIdFromInstance(state, instanceId) {
        for (const [, player] of Object.entries(state.players)) {
            for (const zone of [player.frontLine, player.energyLine, player.hand, player.deck, player.lifeArea, player.sideline]) {
                const found = zone.find((c) => c.instanceId === instanceId);
                if (found)
                    return found.cardId;
            }
        }
        return undefined;
    }
    hasSnipeAbility(card, getCardData) {
        if (!getCardData)
            return false;
        const data = getCardData(card.cardId);
        if (!data)
            return false;
        return data.abilities.some((a) => a.effects.some((e) => e.effectType === 'AllowTargetCharacter' || e.effectType === 'PreventBlock'));
    }
    checkImpact(attacker, getCardData) {
        const data = getCardData(attacker.cardId);
        if (!data)
            return 0;
        let impact = 0;
        for (const ability of data.abilities) {
            for (const effect of ability.effects) {
                if (effect.effectType === 'DealDamage' && ability.timing === 'WhenBattleWins') {
                    impact += effect.params?.amount || 1;
                }
            }
        }
        return impact;
    }
}
exports.BattleSystem = BattleSystem;
//# sourceMappingURL=BattleSystem.js.map