// ============================================================================
// CardSystem 单元测试
// ============================================================================

import { CardSystem } from '../../src/systems/CardSystem';
import { createTestCharacter, createTestSite, createTestEvent } from '../fixtures/test_cards';

describe('CardSystem.validateCard', () => {
  // --- 合法卡牌 ---

  test('should accept a valid Character card', () => {
    const card = createTestCharacter();
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should accept a valid Site card', () => {
    const card = createTestSite();
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(true);
  });

  test('should accept a valid Event card', () => {
    const card = createTestEvent();
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(true);
  });

  // --- 必填字段 ---

  test('should reject card without cardId', () => {
    const card = { ...createTestCharacter(), cardId: '' };
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('cardId'))).toBe(true);
  });

  test('should reject card without sourceMaterial', () => {
    const card = { ...createTestCharacter(), sourceMaterial: undefined } as any;
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sourceMaterial'))).toBe(true);
  });

  test('should reject card with empty affinities (not an array)', () => {
    const card = { ...createTestCharacter(), affinities: null } as any;
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('affinities'))).toBe(true);
  });

  test('should reject card with invalid cardType', () => {
    const card = { ...createTestCharacter(), cardType: 'Invalid' } as any;
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
  });

  test('should reject card with missing requiredEnergy', () => {
    const card = { ...createTestCharacter(), requiredEnergy: null } as any;
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('requiredEnergy'))).toBe(true);
  });

  test('should reject card with negative apCost', () => {
    const card = createTestCharacter({ apCost: -1 });
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
  });

  // --- 类型约束 ---

  test('should reject Character card without bp', () => {
    const card = { ...createTestCharacter(), bp: undefined } as any;
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('bp'))).toBe(true);
  });

  test('should reject Character card with bp.base <= 0', () => {
    const card = createTestCharacter({ bp: { base: 0 } });
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
  });

  test('should reject Character card without energyGeneration', () => {
    const card = { ...createTestCharacter(), energyGeneration: undefined } as any;
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
  });

  test('should reject Event card with bp field', () => {
    const card = { ...createTestEvent(), bp: { base: 1000 } } as any;
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
  });

  // --- 能力格式 ---

  test('should reject card with abilities missing abilityId', () => {
    const card = createTestCharacter({
      abilities: [{ timing: 'WhenPlayed', costs: [], effects: [], isOptional: false } as any],
    });
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('abilityId'))).toBe(true);
  });

  test('should reject card with abilities missing timing', () => {
    const card = createTestCharacter({
      abilities: [{ abilityId: 'A1', costs: [], effects: [], isOptional: false } as any],
    });
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('timing'))).toBe(true);
  });

  test('should reject card with malformed trigger', () => {
    const card = createTestCharacter({
      trigger: { timing: 'Trigger', costs: [], effects: [], isOptional: true } as any,
    });
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('trigger.abilityId'))).toBe(true);
  });

  // --- Raid ---

  test('should reject card with malformed raid', () => {
    const card = createTestCharacter({
      raid: { targetSpecifier: null, raidAbilities: [] } as any,
    });
    const result = CardSystem.validateCard(card);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('targetSpecifier'))).toBe(true);
  });
});

describe('CardSystem.createRegistry', () => {
  test('should build registry with byId lookup', () => {
    const card1 = createTestCharacter({ cardId: 'CARD-A' });
    const card2 = createTestSite({ cardId: 'CARD-B' });
    const registry = CardSystem.createRegistry([card1, card2]);

    expect(registry.all).toHaveLength(2);
    expect(registry.byId.get('CARD-A')).toBe(card1);
    expect(registry.byId.get('CARD-B')).toBe(card2);
    expect(registry.byId.get('NONEXISTENT')).toBeUndefined();
  });

  test('should throw on duplicate cardId', () => {
    const card1 = createTestCharacter({ cardId: 'DUP' });
    const card2 = createTestSite({ cardId: 'DUP' });
    expect(() => CardSystem.createRegistry([card1, card2])).toThrow('Duplicate cardId');
  });
});

describe('CardSystem.loadCardsFromDirectory', () => {
  const path = require('path');
  const testSetDir = path.resolve(__dirname, '../../src/data/cards/test_set');

  test('should load all 8 test cards from disk', () => {
    const cards = CardSystem.loadCardsFromDirectory(testSetDir);
    expect(cards).toHaveLength(20);
    const ids = cards.map((c) => c.cardId).sort();
    expect(ids).toEqual([
      'HTR-1-001', 'HTR-1-002', 'HTR-1-003', 'HTR-1-004',
      'HTR-1-005', 'HTR-1-006', 'HTR-1-007', 'HTR-1-008',
      'HTR-1-009', 'HTR-1-010', 'HTR-1-011', 'HTR-1-012',
      'HTR-1-013', 'HTR-1-014', 'HTR-1-015', 'HTR-1-016',
      'HTR-1-017', 'HTR-1-018', 'HTR-1-019', 'HTR-1-020',
    ]);
  });

  test('all 8 loaded cards should pass validation', () => {
    const cards = CardSystem.loadCardsFromDirectory(testSetDir);
    for (const card of cards) {
      const result = CardSystem.validateCard(card);
      expect(result.errors).toHaveLength(0);
    }
  });

  test('loaded cards should have required fields', () => {
    const cards = CardSystem.loadCardsFromDirectory(testSetDir);
    for (const card of cards) {
      expect(card.sourceMaterial).toBeTruthy();
      expect(Array.isArray(card.affinities)).toBe(true);
      expect(Array.isArray(card.abilities)).toBe(true);
      expect(Array.isArray(card.keywords)).toBe(true);
    }
  });

  test('Character cards should have bp', () => {
    const cards = CardSystem.loadCardsFromDirectory(testSetDir);
    const chars = cards.filter((c) => c.cardType === 'Character');
    expect(chars.length).toBeGreaterThan(0);
    for (const c of chars) {
      expect(c.bp).toBeDefined();
      expect(c.bp!.base).toBeGreaterThan(0);
    }
  });
});

describe('CardSystem.expandKeywords', () => {
  const path = require('path');
  const keywordPath = path.resolve(__dirname, '../../src/data/keywords/keyword_definitions.json');

  test('loads keyword definitions from JSON', () => {
    const defs = CardSystem.loadKeywordDefinitions(keywordPath);
    expect(defs.has('Snipe')).toBe(true);
    expect(defs.has('Impact 1')).toBe(true);
    expect(defs.has('Damage 2')).toBe(true);
    expect(defs.has('Double Attack')).toBe(true);
  });

  test('Snipe keyword expands to AllowTargetCharacter + PreventBlock', () => {
    const defs = CardSystem.loadKeywordDefinitions(keywordPath);
    const card = createTestCharacter({ cardId: 'SNIPE-TEST', keywords: ['Snipe'] });
    const expanded = CardSystem.expandKeywords(card, defs);

    // Snipe = 1 ability with 2 effects
    const allEffects = expanded.abilities.flatMap(a => a.effects.map(e => e.effectType));
    expect(allEffects).toContain('AllowTargetCharacter');
    expect(allEffects).toContain('PreventBlock');
  });

  test('Impact 1 keyword expands', () => {
    const defs = CardSystem.loadKeywordDefinitions(keywordPath);
    const card = createTestCharacter({ cardId: 'IMP-TEST', keywords: ['Impact 1'] });
    const expanded = CardSystem.expandKeywords(card, defs);

    expect(expanded.abilities.some(a =>
      a.timing === 'WhenBattleWins' && a.effects.some(e => e.effectType === 'DealDamage')
    )).toBe(true);
  });

  test('multiple keywords expand correctly', () => {
    const defs = CardSystem.loadKeywordDefinitions(keywordPath);
    const card = createTestCharacter({ cardId: 'MULTI-TEST', keywords: ['Step', 'Nullify Impact'] });
    const expanded = CardSystem.expandKeywords(card, defs);

    expect(expanded.abilities.some(a => a.effects.some(e => e.effectType === 'AllowReverseMovement'))).toBe(true);
    expect(expanded.abilities.some(a => a.effects.some(e => e.effectType === 'NullifyKeyword'))).toBe(true);
  });

  test('card without keywords is unchanged', () => {
    const defs = CardSystem.loadKeywordDefinitions(keywordPath);
    const card = createTestCharacter({ cardId: 'NO-KW', keywords: [] });
    const expanded = CardSystem.expandKeywords(card, defs);

    expect(expanded.abilities).toHaveLength(card.abilities.length);
  });

  test('B4 explicit Snipe ≈ B5 keyword Snipe (equivalence check)', () => {
    const defs = CardSystem.loadKeywordDefinitions(keywordPath);
    // B4 version: explicit abilities
    const b4Card = createTestCharacter({
      cardId: 'B4-SNIPE',
      abilities: [
        { abilityId: 'B4-1', timing: 'WhenAttacking', costs: [], effects: [{ effectType: 'AllowTargetCharacter' }, { effectType: 'PreventBlock' }], isOptional: false },
      ],
      keywords: [],
    });
    // B5 version: keyword
    const b5Card = createTestCharacter({ cardId: 'B5-SNIPE', keywords: ['Snipe'] });
    const expanded = CardSystem.expandKeywords(b5Card, defs);

    // Both should have the same effect types in their abilities
    const b4Effects = b4Card.abilities.flatMap(a => a.effects.map(e => e.effectType)).sort();
    const b5Effects = expanded.abilities.flatMap(a => a.effects.map(e => e.effectType)).sort();
    expect(b5Effects).toEqual(b4Effects);
  });
});
