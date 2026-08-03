"use strict";
// ============================================================================
// Union Arena Digital — TurnManager (Batch 2)
// ============================================================================
// 5 阶段状态机：Start → Movement → Main → Attack → End
// 阶段内自动动作、玩家切换、回合计数、RQ-008 先手限制。
//
// 设计决策：
//   - game-level 状态变更（phase/turn/currentPlayer）由 TurnManager 直接创建
//     新 GameState，不经过 StateChange。这避免了为 game-level 字段扩展
//     StateChange 类型（StateChange 专注 player-scoped 操作）。
//   - player-scoped 变更（抽牌/AP调整/状态切换）通过 applyChanges + StateChange。
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurnManager = void 0;
const GameState_1 = require("./GameState");
class TurnManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    /**
     * 判断当前状态下是否允许进入 Attack Phase。
     * RQ-008: Player One Turn 1 不能进入 Attack Phase。
     */
    canEnterAttackPhase(state) {
        const player = state.players[state.currentPlayerId];
        return !(state.turnNumber === 1 && player.playerOrder === 'PlayerOne');
    }
    /**
     * 获取下一阶段（不修改状态）。
     */
    getNextPhase(state) {
        switch (state.phase) {
            case 'Setup':
                return 'Start';
            case 'Start':
                return 'Movement';
            case 'Movement':
                return 'Main';
            case 'Main':
                // RQ-008: 先手第1回合跳过 Attack
                if (!this.canEnterAttackPhase(state)) {
                    return 'End';
                }
                return 'Attack'; // 玩家可选择 Attack 或 End — 默认返回 Attack
            case 'Attack':
                return 'End';
            case 'End':
                return 'Start'; // 切换玩家后进入对手 Start
            default:
                return state.phase;
        }
    }
    /**
     * 推进到下一阶段。返回新的 GameState 和触发的事件。
     * 自动执行阶段的入口/出口动作。
     */
    advancePhase(state) {
        const nextPhase = this.getNextPhase(state);
        const events = [];
        // 记录旧阶段（用于事件）
        const previousPhase = state.phase;
        // 先执行当前阶段的出口动作
        let workingState = state;
        // 如果是 End → Start，先切换玩家/回合
        if (state.phase === 'End' && nextPhase === 'Start') {
            workingState = this.switchToNextPlayer(workingState);
            const turnEndedEvent = this.createEvent('TurnEnded', workingState);
            events.push(turnEndedEvent);
            this.eventBus.emit(turnEndedEvent);
        }
        // 设置新阶段
        workingState = this.setPhase(workingState, nextPhase);
        const phaseEvent = this.createPhaseEvent(workingState, nextPhase, previousPhase);
        events.push(phaseEvent);
        this.eventBus.emit(phaseEvent);
        // 执行新阶段的入口动作
        let phaseResult;
        switch (nextPhase) {
            case 'Start':
                phaseResult = this.executeStartPhase(workingState);
                break;
            case 'Movement':
                phaseResult = { newState: workingState, events: [] };
                break;
            case 'Main':
                phaseResult = { newState: workingState, events: [] };
                break;
            case 'Attack':
                phaseResult = { newState: workingState, events: [] };
                break;
            case 'End':
                phaseResult = this.executeEndPhase(workingState);
                break;
            default:
                phaseResult = { newState: workingState, events: [] };
        }
        events.push(...phaseResult.events);
        // TurnStarted 事件
        if (nextPhase === 'Start') {
            const turnStartedEvent = {
                eventType: 'TurnStarted',
                sourcePlayerId: phaseResult.newState.currentPlayerId,
                data: { turnNumber: phaseResult.newState.turnNumber },
            };
            events.push(turnStartedEvent);
            this.eventBus.emit(turnStartedEvent);
        }
        return { newState: phaseResult.newState, events };
    }
    // ==========================================================================
    // Start Phase 入口动作
    // ==========================================================================
    executeStartPhase(state) {
        const playerId = state.currentPlayerId;
        const player = state.players[playerId];
        const changes = [];
        const events = [];
        // 1. 清除 UNTIL_START_OF_NEXT_TURN 效果（B3+，当前跳过）
        // 2. 全部角色/Site → Active
        for (const card of [...player.frontLine, ...player.energyLine]) {
            if (card.state === 'Resting') {
                changes.push({
                    type: 'SET_FIELD_STATE',
                    instanceId: card.instanceId,
                    state: 'Active',
                    playerId,
                });
            }
        }
        // 3. AP 全部 → Active
        for (const ap of player.apArea) {
            if (ap.state === 'Resting') {
                changes.push({
                    type: 'SET_FIELD_STATE',
                    instanceId: ap.instanceId,
                    state: 'Active',
                    playerId,
                });
            }
        }
        // 4. 调整 AP 数量
        const targetAP = getAPCount(player.playerOrder, state.turnNumber);
        const currentAP = player.apArea.length;
        if (targetAP > currentAP) {
            changes.push({ type: 'ADJUST_AP', playerId, delta: targetAP - currentAP });
        }
        else if (targetAP < currentAP) {
            changes.push({ type: 'ADJUST_AP', playerId, delta: targetAP - currentAP });
        }
        // 5. 强制抽牌（先手第1回合跳过）
        const isFirstTurn = state.turnNumber === 1 && player.playerOrder === 'PlayerOne';
        if (!isFirstTurn) {
            if (player.deck.length > 0) {
                changes.push({ type: 'DRAW_CARD', playerId, count: 1 });
            }
            else {
                // 牌库空 → 对方胜利
                const opponentId = (0, GameState_1.getOpponentId)(state, playerId);
                let workingState = (0, GameState_1.applyChanges)(state, changes);
                workingState = { ...workingState, winner: opponentId, phase: 'GameOver' };
                return { newState: workingState, events };
            }
        }
        let workingState = (0, GameState_1.applyChanges)(state, changes);
        // 6. 额外抽牌（支付1AP）— 返回可选操作提示，不在自动执行中处理
        //    TurnManager 调用方检查 getValidActions 提供此选项
        return { newState: workingState, events };
    }
    // ==========================================================================
    // End Phase 入口动作
    // ==========================================================================
    executeEndPhase(state) {
        const playerId = state.currentPlayerId;
        const player = state.players[playerId];
        const changes = [];
        const events = [];
        // 1. 激活 End Phase 能力（B3+，当前跳过）
        // 2. 全部角色/Site → Active（AP 保持原状）
        for (const card of [...player.frontLine, ...player.energyLine]) {
            if (card.state === 'Resting') {
                changes.push({
                    type: 'SET_FIELD_STATE',
                    instanceId: card.instanceId,
                    state: 'Active',
                    playerId,
                });
            }
        }
        // 3. 手牌上限检查：超过 8 张 → 保留 8 张，其余进 Removal Area
        //    RQ-006: 手牌持有者本人选择保留哪些
        //    MVP: 自动保留前 8 张（选择逻辑在 B3+ ActionSystem 中实现）
        if (player.hand.length > 8) {
            const excess = player.hand.length - 8;
            // 默认丢弃最后面的 excess 张（简化为从末尾开始移除）
            for (let i = 0; i < excess; i++) {
                const card = player.hand[player.hand.length - 1 - i];
                changes.push({
                    type: 'MOVE_CARD',
                    instanceId: card.instanceId,
                    from: 'Hand',
                    to: 'RemovalArea',
                    playerId,
                });
            }
        }
        // 4. 清除 UNTIL_END_OF_TURN 效果（B3+，当前跳过）
        let workingState = (0, GameState_1.applyChanges)(state, changes);
        return { newState: workingState, events };
    }
    // ==========================================================================
    // 玩家切换 & 回合管理
    // ==========================================================================
    switchToNextPlayer(state) {
        const opponentId = (0, GameState_1.getOpponentId)(state, state.currentPlayerId);
        const isPlayerOneTurn = state.players[state.currentPlayerId].playerOrder === 'PlayerTwo';
        const newTurn = isPlayerOneTurn ? state.turnNumber + 1 : state.turnNumber;
        return {
            ...state,
            currentPlayerId: opponentId,
            turnNumber: newTurn,
        };
    }
    setPhase(state, phase) {
        return { ...state, phase };
    }
    // ==========================================================================
    // 事件创建
    // ==========================================================================
    createEvent(eventType, state) {
        return {
            eventType,
            sourcePlayerId: state.currentPlayerId,
            data: { turnNumber: state.turnNumber, phase: state.phase },
        };
    }
    createPhaseEvent(state, newPhase, previousPhase) {
        return {
            eventType: 'PhaseChanged',
            sourcePlayerId: state.currentPlayerId,
            data: {
                turnNumber: state.turnNumber,
                previousPhase,
                newPhase,
            },
        };
    }
}
exports.TurnManager = TurnManager;
// ============================================================================
// AP 数量表
// ============================================================================
function getAPCount(playerOrder, turnNumber) {
    if (turnNumber >= 3)
        return 3;
    if (turnNumber === 2)
        return 2;
    // Turn 1
    return playerOrder === 'PlayerOne' ? 1 : 2;
}
//# sourceMappingURL=TurnManager.js.map