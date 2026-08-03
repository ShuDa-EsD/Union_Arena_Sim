import { CardData, GamePhase, GameState, PlayerState, StateChange } from './types';
export declare function createGameState(config: {
    gameId: string;
    playerOneId: string;
    playerTwoId: string;
    deck1: CardData[];
    deck2: CardData[];
}): GameState;
export declare function getPlayer(state: GameState, playerId: string): PlayerState | undefined;
export declare function getPhase(state: GameState): GamePhase;
export declare function getTurnNumber(state: GameState): number;
export declare function getCurrentPlayerId(state: GameState): string;
export declare function getWinner(state: GameState): string | null;
export declare function getOpponentId(state: GameState, playerId: string): string;
/**
 * 应用一组 StateChange，返回新的 GameState。
 * 所有变更原子性应用 — 任一变更失败则整个操作回滚（返回原 state）。
 */
export declare function applyChanges(state: GameState, changes: StateChange[]): GameState;
//# sourceMappingURL=GameState.d.ts.map