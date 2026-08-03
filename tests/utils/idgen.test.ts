// ============================================================================
// generateInstanceId 单元测试
// ============================================================================

import { generateInstanceId, resetInstanceCounter } from '../../src/utils/idgen';

describe('generateInstanceId', () => {
  beforeEach(() => {
    resetInstanceCounter();
  });

  test('should generate IDs with correct prefix format', () => {
    const id = generateInstanceId();
    expect(id).toMatch(/^inst-\d+-[0-9a-f]{4}$/);
  });

  test('should generate unique IDs across 1000 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = generateInstanceId();
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
    expect(ids.size).toBe(1000);
  });

  test('should have incrementing counters in IDs', () => {
    const id1 = generateInstanceId(); // inst-1-xxxx
    const id2 = generateInstanceId(); // inst-2-xxxx
    const id3 = generateInstanceId(); // inst-3-xxxx

    const counter1 = parseInt(id1.split('-')[1], 10);
    const counter2 = parseInt(id2.split('-')[1], 10);
    const counter3 = parseInt(id3.split('-')[1], 10);

    expect(counter1).toBe(1);
    expect(counter2).toBe(2);
    expect(counter3).toBe(3);
  });

  test('should reset counter when resetInstanceCounter is called', () => {
    generateInstanceId();
    generateInstanceId();
    resetInstanceCounter();

    const id = generateInstanceId();
    expect(id).toMatch(/^inst-1-[0-9a-f]{4}$/);
  });
});
