"use strict";
// ============================================================================
// Union Arena Digital — Shuffle Utility
// ============================================================================
// Fisher-Yates 洗牌算法，返回新数组（不修改原数组）。
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.shuffle = shuffle;
/**
 * Fisher-Yates 洗牌。返回新数组，不修改原数组。
 */
function shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
//# sourceMappingURL=shuffle.js.map