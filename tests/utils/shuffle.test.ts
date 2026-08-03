// ============================================================================
// shuffle 单元测试
// ============================================================================

import { shuffle } from '../../src/utils/shuffle';

describe('shuffle', () => {
  test('should return an array of the same length', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffle(input);
    expect(result.length).toBe(input.length);
  });

  test('should contain the same elements', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffle(input);
    expect(result.sort()).toEqual(input.sort());
  });

  test('should not modify the original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  test('should handle empty array', () => {
    const input: number[] = [];
    const result = shuffle(input);
    expect(result).toEqual([]);
  });

  test('should handle single-element array', () => {
    const input = [42];
    const result = shuffle(input);
    expect(result).toEqual([42]);
  });

  test('should work with objects', () => {
    const input = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ];
    const result = shuffle(input);
    expect(result.length).toBe(3);
    const ids = result.map((o) => o.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  test('should return different order for a large array (probabilistic)', () => {
    // 对 100 个元素的数组洗牌，几乎必定改变顺序
    const input = Array.from({ length: 100 }, (_, i) => i);
    const result = shuffle(input);
    // 检查不是完全相同的顺序
    const sameOrder = input.every((val, idx) => val === result[idx]);
    expect(sameOrder).toBe(false);
  });
});
