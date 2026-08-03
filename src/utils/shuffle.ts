// ============================================================================
// Union Arena Digital — Shuffle Utility
// ============================================================================
// Fisher-Yates 洗牌算法，返回新数组（不修改原数组）。
// ============================================================================

/**
 * Fisher-Yates 洗牌。返回新数组，不修改原数组。
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
