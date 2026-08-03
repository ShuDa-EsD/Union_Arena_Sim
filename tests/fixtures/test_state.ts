// ============================================================================
// 测试用 GameState 工厂
// ============================================================================

import { GameState } from '../../src/core/types';
import { createGameState } from '../../src/core/GameState';
import { CardData } from '../../src/core/types';

/**
 * 快速创建测试用 GameState。
 * 自动生成双方 50 张卡组。
 */
export function createTestGameState(overrides: {
  gameId?: string;
  playerOneId?: string;
  playerTwoId?: string;
  deck1?: CardData[];
  deck2?: CardData[];
} = {}): GameState {
  const { createTestCharacter, createTestDeck } = require('./test_cards');

  const vanillaChar = createTestCharacter({ cardId: 'VANILLA-001', cardName: 'Vanilla' });
  const deck1 = overrides.deck1 || createTestDeck([vanillaChar], 50);
  const deck2 = overrides.deck2 || createTestDeck([vanillaChar], 50);

  return createGameState({
    gameId: overrides.gameId || 'test-game-1',
    playerOneId: overrides.playerOneId || 'player-1',
    playerTwoId: overrides.playerTwoId || 'player-2',
    deck1,
    deck2,
  });
}
