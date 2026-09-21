// ============================================================================
// CardSchema 单元测试
// ============================================================================

import {
  CARD_TYPES,
  ENERGY_COLORS,
  createTemplateCard,
  getFieldsForCardType,
} from '../../editor/CardSchema';

describe('CardSchema — 字段元数据', () => {
  test('定义全部 4 种卡牌类型', () => {
    expect(CARD_TYPES).toEqual(['Character', 'Site', 'Event', 'AP']);
  });

  test('定义能量颜色', () => {
    expect(ENERGY_COLORS).toContain('白');
    expect(ENERGY_COLORS).toContain('红');
    expect(ENERGY_COLORS).toHaveLength(6);
  });

  test('Character 字段包含 bp.base / energyGeneration / raid', () => {
    const keys = getFieldsForCardType('Character').map((f) => f.fieldKey);
    expect(keys).toContain('bp.base');
    expect(keys).toContain('energyGeneration');
    expect(keys).toContain('raid');
    expect(keys).toContain('abilities');
    expect(keys).toContain('trigger');
  });

  test('Site 字段包含 energyGeneration，但不含 bp.base / raid', () => {
    const keys = getFieldsForCardType('Site').map((f) => f.fieldKey);
    expect(keys).toContain('energyGeneration');
    expect(keys).not.toContain('bp.base');
    expect(keys).not.toContain('raid');
  });

  test('Event 字段不含 bp.base / energyGeneration', () => {
    const keys = getFieldsForCardType('Event').map((f) => f.fieldKey);
    expect(keys).not.toContain('bp.base');
    expect(keys).not.toContain('energyGeneration');
    expect(keys).not.toContain('raid');
  });

  test('AP 字段仅含通用字段（无 bp/energyGeneration/abilities/trigger/raid/keywords）', () => {
    const keys = getFieldsForCardType('AP').map((f) => f.fieldKey);
    expect(keys).toEqual(expect.arrayContaining([
      'cardId',
      'cardName',
      'cardType',
      'sourceMaterial',
      'affinities',
      'requiredEnergy.color',
      'requiredEnergy.amount',
      'apCost',
    ]));
    expect(keys).not.toContain('bp.base');
    expect(keys).not.toContain('energyGeneration');
    expect(keys).not.toContain('abilities');
    expect(keys).not.toContain('trigger');
    expect(keys).not.toContain('raid');
    expect(keys).not.toContain('keywords');
  });

  test('所有卡牌类型都包含通用必填字段', () => {
    const commonKeys = [
      'cardId',
      'cardName',
      'cardType',
      'sourceMaterial',
      'affinities',
      'requiredEnergy.color',
      'requiredEnergy.amount',
      'apCost',
    ];
    for (const type of CARD_TYPES) {
      const keys = getFieldsForCardType(type).map((f) => f.fieldKey);
      for (const ck of commonKeys) {
        expect(keys).toContain(ck);
      }
    }
  });
});

describe('CardSchema — createTemplateCard', () => {
  test('Character 模板含 bp 与 energyGeneration', () => {
    const card = createTemplateCard('Character');
    expect(card.cardType).toBe('Character');
    expect(card.bp).toEqual({ base: 3000 });
    expect(card.energyGeneration).toEqual([{ color: '白', amount: 1 }]);
  });

  test('Site 模板含 energyGeneration 但无 bp', () => {
    const card = createTemplateCard('Site');
    expect(card.cardType).toBe('Site');
    expect(card.energyGeneration).toBeDefined();
    expect(card.bp).toBeUndefined();
  });

  test('Event 模板无 bp / energyGeneration', () => {
    const card = createTemplateCard('Event');
    expect(card.cardType).toBe('Event');
    expect(card.bp).toBeUndefined();
    expect(card.energyGeneration).toBeUndefined();
  });

  test('AP 模板保留正确的最小结构', () => {
    const card = createTemplateCard('AP');
    expect(card.cardType).toBe('AP');
    expect(card.bp).toBeUndefined();
    expect(card.energyGeneration).toBeUndefined();
    expect(card.trigger).toBeUndefined();
    expect(card.raid).toBeUndefined();
    // validateCard 要求全类型都具备这些数组字段
    expect(card.abilities).toEqual([]);
    expect(card.keywords).toEqual([]);
    expect(card.affinities).toEqual([]);
    expect(card.apCost).toBe(0);
  });
});
