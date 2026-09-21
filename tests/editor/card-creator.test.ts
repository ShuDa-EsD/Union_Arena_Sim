// ============================================================================
// Card Creator CLI — applyAnswers 单元测试（复用 CardEditorEngine）
// ============================================================================

import * as path from 'path';
import { CardEditorEngine } from '../../editor/CardEditorEngine';
import { applyAnswers } from '../../editor/cli/card-creator';
import { CardSystem } from '../../src/systems/CardSystem';

function loadEngine(): CardEditorEngine {
  const keywordPath = path.resolve(__dirname, '../../src/data/keywords/keyword_definitions.json');
  return new CardEditorEngine(CardSystem.loadKeywordDefinitions(keywordPath));
}

describe('card-creator applyAnswers（复用 CardEditorEngine）', () => {
  test('构建合法 Character 卡并通过 validateCard', () => {
    const engine = loadEngine();
    const state = applyAnswers(engine, {
      cardType: 'Character',
      cardId: 'CLI-001',
      cardName: 'CLI Warrior',
      sourceMaterial: 'HTR',
      affinities: ['Hunter'],
      requiredEnergyColor: '白',
      requiredEnergyAmount: 1,
      apCost: 1,
      bpBase: 3000,
    });
    expect(engine.validate(state)).toEqual({ valid: true, errors: [] });
  });

  test('keyword 通过 CardSystem.expandKeywords 展开（复用，未重实现）', () => {
    const engine = loadEngine();
    const state = applyAnswers(engine, {
      cardType: 'Character',
      cardId: 'CLI-002',
      cardName: 'Sniper',
      sourceMaterial: 'HTR',
      requiredEnergyColor: '白',
      requiredEnergyAmount: 1,
      apCost: 1,
      bpBase: 3000,
      keywords: ['Snipe'],
    });
    const expanded = engine.previewExpansion(state);
    const effects = expanded.abilities.flatMap((a) => a.effects.map((e) => e.effectType));
    expect(effects).toContain('AllowTargetCharacter');
    expect(effects).toContain('PreventBlock');
  });

  test('构建合法 AP 卡', () => {
    const engine = loadEngine();
    const state = applyAnswers(engine, {
      cardType: 'AP',
      cardId: 'CLI-AP-1',
      cardName: 'AP Card',
      sourceMaterial: 'HTR',
      requiredEnergyColor: '白',
      requiredEnergyAmount: 0,
      apCost: 0,
    });
    expect(engine.validate(state).valid).toBe(true);
  });

  test('构建合法 Site / Event 卡', () => {
    const engine = loadEngine();
    const site = applyAnswers(engine, {
      cardType: 'Site',
      cardId: 'CLI-S-1',
      cardName: 'Site',
      sourceMaterial: 'HTR',
      requiredEnergyColor: '白',
      requiredEnergyAmount: 1,
      apCost: 1,
    });
    expect(engine.validate(site).valid).toBe(true);

    const event = applyAnswers(engine, {
      cardType: 'Event',
      cardId: 'CLI-E-1',
      cardName: 'Event',
      sourceMaterial: 'HTR',
      requiredEnergyColor: '白',
      requiredEnergyAmount: 1,
      apCost: 1,
    });
    expect(engine.validate(event).valid).toBe(true);
  });

  test('含 abilities / trigger / raid 的卡通过验证', () => {
    const engine = loadEngine();
    const state = applyAnswers(engine, {
      cardType: 'Character',
      cardId: 'CLI-003',
      cardName: 'Full',
      sourceMaterial: 'HTR',
      requiredEnergyColor: '白',
      requiredEnergyAmount: 1,
      apCost: 1,
      bpBase: 3000,
      abilities: [
        {
          abilityId: 'A1',
          timing: 'WhenPlayed',
          costs: [],
          effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
          isOptional: false,
        },
      ],
      trigger: {
        abilityId: 'T1',
        timing: 'Trigger',
        costs: [],
        effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
        isOptional: true,
      },
      raid: { targetSpecifier: { type: 'Name', value: 'HTR-1-001' }, raidAbilities: [] },
    });
    expect(engine.validate(state).valid).toBe(true);
    expect(state.card.abilities).toHaveLength(1);
    expect(state.card.trigger?.abilityId).toBe('T1');
    expect(state.card.raid?.targetSpecifier.value).toBe('HTR-1-001');
  });

  test('缺少身份字段时 validate 返回 false', () => {
    const engine = loadEngine();
    const state = applyAnswers(engine, {
      cardType: 'Character',
      cardId: '',
      cardName: '',
      sourceMaterial: '',
      requiredEnergyColor: '白',
      requiredEnergyAmount: 1,
      apCost: 1,
      bpBase: 3000,
    });
    const result = engine.validate(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('cardId') || e.includes('cardName'))).toBe(true);
  });
});
