// ============================================================================
// CardEditorEngine 单元测试
// ============================================================================

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CardEditorEngine, DEFAULT_CUSTOM_DIR } from '../../editor/CardEditorEngine';
import { CardSystem } from '../../src/systems/CardSystem';
import { createTestCharacter, createTestEvent, createTestSite } from '../fixtures/test_cards';

function loadKeywordDefs(): Map<string, any[]> {
  const keywordPath = path.resolve(__dirname, '../../src/data/keywords/keyword_definitions.json');
  return CardSystem.loadKeywordDefinitions(keywordPath);
}

describe('CardEditorEngine — 导入 / 导出', () => {
  test('importCard + exportCard 关键字段无损', () => {
    const engine = new CardEditorEngine();
    const source = createTestCharacter({ cardId: 'R-1', cardName: 'Round Trip' });
    const state = engine.importCard(source);
    const exported = engine.exportCard(state);

    expect(exported.cardId).toBe('R-1');
    expect(exported.cardName).toBe('Round Trip');
    expect(exported.cardType).toBe('Character');
    expect(exported.bp).toEqual({ base: 3000 });
    expect(exported.energyGeneration).toEqual([{ color: '白', amount: 1 }]);
  });

  test('exportCard 返回深拷贝，改动不污染编辑器状态', () => {
    const engine = new CardEditorEngine();
    const state = engine.importCard(createTestCharacter({ cardId: 'R-2' }));
    const exported = engine.exportCard(state);
    exported.cardName = 'Hacked';
    expect(state.card.cardName).not.toBe('Hacked');
  });
});

describe('CardEditorEngine — validate 复用 CardSystem.validateCard', () => {
  const engine = new CardEditorEngine();

  test('合法卡牌通过验证', () => {
    const state = engine.importCard(createTestCharacter({ cardId: 'V-1' }));
    expect(engine.validate(state)).toEqual({ valid: true, errors: [] });
  });

  test('Character 缺少 bp 时失败（引擎规则）', () => {
    const card = { ...createTestCharacter({ cardId: 'V-2' }), bp: undefined } as any;
    const state = engine.importCard(card);
    const result = engine.validate(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('bp'))).toBe(true);
  });

  test('空白模板报告身份字段错误', () => {
    const state = engine.createTemplate('Character');
    const result = engine.validate(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('cardId'))).toBe(true);
    expect(result.errors.some((e) => e.includes('cardName'))).toBe(true);
    expect(result.errors.some((e) => e.includes('sourceMaterial'))).toBe(true);
  });

  test('Site 缺少 energyGeneration 时失败', () => {
    const card = { ...createTestSite({ cardId: 'V-4' }), energyGeneration: undefined } as any;
    const state = engine.importCard(card);
    expect(engine.validate(state).valid).toBe(false);
  });

  test('Event 含 bp 时失败', () => {
    const card = { ...createTestEvent({ cardId: 'V-5' }), bp: { base: 1000 } } as any;
    const state = engine.importCard(card);
    const result = engine.validate(state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('bp'))).toBe(true);
  });
});

describe('CardEditorEngine — previewExpansion 复用 CardSystem.expandKeywords', () => {
  test('Snipe 关键词展开为等效能力', () => {
    const engine = new CardEditorEngine(loadKeywordDefs());
    const state = engine.importCard(createTestCharacter({ cardId: 'P-1', keywords: ['Snipe'] }));
    const expanded = engine.previewExpansion(state);
    const effects = expanded.abilities.flatMap((a) => a.effects.map((e) => e.effectType));
    expect(effects).toContain('AllowTargetCharacter');
    expect(effects).toContain('PreventBlock');
  });

  test('无关键词时不展开', () => {
    const engine = new CardEditorEngine(loadKeywordDefs());
    const state = engine.importCard(createTestCharacter({ cardId: 'P-2', keywords: [] }));
    const expanded = engine.previewExpansion(state);
    expect(expanded.abilities).toHaveLength(state.card.abilities.length);
  });

  test('预览结果与 CardSystem.expandKeywords 一致', () => {
    const defs = loadKeywordDefs();
    const engine = new CardEditorEngine(defs);
    const state = engine.importCard(createTestCharacter({ cardId: 'P-3', keywords: ['Step'] }));
    expect(engine.previewExpansion(state)).toEqual(CardSystem.expandKeywords(state.card, defs));
  });
});

describe('CardEditorEngine — 字段与子对象编辑', () => {
  const engine = new CardEditorEngine();

  test('updateField 支持顶层与嵌套字段', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'F-1' }));
    state = engine.updateField(state, 'cardName', 'New Name');
    state = engine.updateField(state, 'bp.base', 4500);
    state = engine.updateField(state, 'requiredEnergy.color', '红');
    expect(state.card.cardName).toBe('New Name');
    expect(state.card.bp).toEqual({ base: 4500 });
    expect(state.card.requiredEnergy.color).toBe('红');
  });

  test('addAbility / updateAbility / removeAbility', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'F-2' }));
    state = engine.addAbility(state, {
      abilityId: 'A1',
      timing: 'WhenPlayed',
      costs: [],
      effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
      isOptional: false,
    });
    expect(state.card.abilities).toHaveLength(1);

    state = engine.updateAbility(state, 0, {
      abilityId: 'A1',
      timing: 'ActivateMain',
      costs: [],
      effects: [],
      isOptional: true,
    });
    expect(state.card.abilities[0].timing).toBe('ActivateMain');

    state = engine.removeAbility(state, 0);
    expect(state.card.abilities).toHaveLength(0);
  });

  test('removeAbility 越界抛错', () => {
    const state = engine.importCard(createTestCharacter({ cardId: 'F-3' }));
    expect(() => engine.removeAbility(state, 5)).toThrow('out of range');
  });

  test('setRaid / setTrigger', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'F-4' }));
    state = engine.setRaid(state, {
      targetSpecifier: { type: 'Name', value: 'HTR-1-001' },
      raidAbilities: [],
    });
    expect(state.card.raid?.targetSpecifier.value).toBe('HTR-1-001');

    state = engine.setTrigger(state, {
      abilityId: 'T1',
      timing: 'Trigger',
      costs: [],
      effects: [],
      isOptional: true,
    });
    expect(state.card.trigger?.abilityId).toBe('T1');

    state = engine.setRaid(state, null);
    expect(state.card.raid).toBeUndefined();
  });

  test('toggleKeyword 添加/移除关键词', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'F-5', keywords: [] }));
    state = engine.toggleKeyword(state, 'Snipe');
    expect(state.card.keywords).toContain('Snipe');
    state = engine.toggleKeyword(state, 'Snipe');
    expect(state.card.keywords).not.toContain('Snipe');
  });
});

describe('CardEditorEngine — 保存 / 加载', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-editor-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('saveToFile 写入 JSON 且 loadFromFile 读回一致', () => {
    const engine = new CardEditorEngine();
    const source = createTestCharacter({
      cardId: 'SAVE-1',
      cardName: 'Save Me',
      abilities: [
        {
          abilityId: 'S1',
          timing: 'WhenPlayed',
          costs: [],
          effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
          isOptional: false,
        },
      ],
    });
    let state = engine.importCard(source);
    const filePath = path.join(tmpDir, 'SAVE-1.json');
    state = engine.saveToFile(state, filePath);

    expect(state.dirty).toBe(false);
    expect(state.sourceFile).toBe(filePath);
    expect(fs.existsSync(filePath)).toBe(true);

    const loaded = engine.loadFromFile(filePath);
    expect(loaded.card).toEqual(state.card);
    expect(loaded.sourceFile).toBe(filePath);
    expect(loaded.dirty).toBe(false);
  });

  test('saveToFile 无效卡抛错且不写文件', () => {
    const engine = new CardEditorEngine();
    const state = engine.createTemplate('Character'); // 身份字段为空 -> 无效
    const filePath = path.join(tmpDir, 'bad.json');
    expect(() => engine.saveToFile(state, filePath)).toThrow(/invalid card/i);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('resolveSavePath 默认指向 DEFAULT_CUSTOM_DIR', () => {
    const engine = new CardEditorEngine();
    const state = engine.importCard(createTestCharacter({ cardId: 'SAVE-3' }));
    const resolved = engine.resolveSavePath(state);
    expect(resolved).toBe(path.join(DEFAULT_CUSTOM_DIR, 'SAVE-3.json'));
  });

  test('DEFAULT_CUSTOM_DIR 指向 src/data/cards/custom', () => {
    expect(path.basename(DEFAULT_CUSTOM_DIR)).toBe('custom');
    expect(DEFAULT_CUSTOM_DIR).toContain(path.join('src', 'data', 'cards', 'custom'));
  });
});

describe('CardEditorEngine — AP 卡支持', () => {
  const engine = new CardEditorEngine();

  test('createTemplate("AP") 生成正确 AP 结构', () => {
    const state = engine.createTemplate('AP');
    expect(state.card.cardType).toBe('AP');
    expect(state.card.bp).toBeUndefined();
    expect(state.card.energyGeneration).toBeUndefined();
    expect(state.card.raid).toBeUndefined();
    expect(state.card.trigger).toBeUndefined();
    expect(state.card.abilities).toEqual([]);
    expect(state.card.keywords).toEqual([]);
  });

  test('填写身份字段后 AP 卡通过 validateCard', () => {
    let state = engine.createTemplate('AP');
    state = engine.updateField(state, 'cardId', 'AP-001');
    state = engine.updateField(state, 'cardName', 'Custom AP');
    state = engine.updateField(state, 'sourceMaterial', 'HTR');
    state = engine.updateField(state, 'requiredEnergy.color', '白');
    state = engine.updateField(state, 'requiredEnergy.amount', 0);
    const result = engine.validate(state);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('AP 卡导出 JSON 与 CardSystem 兼容（validateCard 可接受）', () => {
    let state = engine.createTemplate('AP');
    state = engine.updateField(state, 'cardId', 'AP-002');
    state = engine.updateField(state, 'cardName', 'Another AP');
    state = engine.updateField(state, 'sourceMaterial', 'HTR');
    const exported = engine.exportCard(state);
    expect(exported.cardType).toBe('AP');
    expect(CardSystem.validateCard(exported).valid).toBe(true);
  });
});

describe('CardEditorEngine — A1 不完整卡牌归一化', () => {
  const engine = new CardEditorEngine();

  test('缺少 abilities 时 addAbility 不崩溃', () => {
    const raw = createTestCharacter({ cardId: 'A1-1' }) as any;
    delete raw.abilities;
    const state = engine.importCard(raw);
    expect(state.card.abilities).toEqual([]);
    const next = engine.addAbility(state);
    expect(next.card.abilities).toHaveLength(1);
  });

  test('缺少 keywords 时 toggleKeyword 不崩溃', () => {
    const raw = createTestCharacter({ cardId: 'A1-2' }) as any;
    delete raw.keywords;
    const state = engine.importCard(raw);
    expect(state.card.keywords).toEqual([]);
    const next = engine.toggleKeyword(state, 'Snipe');
    expect(next.card.keywords).toEqual(['Snipe']);
  });

  test('缺少 affinities 时归一化为 [] 且后续编辑不崩溃', () => {
    const raw = createTestCharacter({ cardId: 'A1-3' }) as any;
    delete raw.affinities;
    const state = engine.importCard(raw);
    expect(state.card.affinities).toEqual([]);
    const next = engine.updateField(state, 'cardName', 'Edited');
    expect(next.card.cardName).toBe('Edited');
    expect(next.card.affinities).toEqual([]);
    expect(engine.exportCard(next).affinities).toEqual([]);
  });

  test('完整合法 CardData 的 import 行为不变化', () => {
    const source = createTestCharacter({
      cardId: 'A1-4',
      cardName: 'Complete',
      abilities: [
        {
          abilityId: 'A',
          timing: 'WhenPlayed',
          costs: [],
          effects: [{ effectType: 'DrawCard', params: { count: 1 } }],
          isOptional: false,
        },
      ],
      keywords: ['Snipe'],
      affinities: ['Hunter', 'Elite'],
    });
    const state = engine.importCard(source);
    expect(state.card.abilities).toHaveLength(1);
    expect(state.card.abilities[0].abilityId).toBe('A');
    expect(state.card.keywords).toEqual(['Snipe']);
    expect(state.card.affinities).toEqual(['Hunter', 'Elite']);
  });

  test('loadFromFile 对缺失数组字段的 JSON 归一化', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-editor-a1-'));
    try {
      const filePath = path.join(tmpDir, 'partial.json');
      const partial = { ...createTestCharacter({ cardId: 'A1-5' }) } as any;
      delete partial.abilities;
      delete partial.keywords;
      delete partial.affinities;
      fs.writeFileSync(filePath, JSON.stringify(partial, null, 2));

      const state = engine.loadFromFile(filePath);
      expect(state.card.abilities).toEqual([]);
      expect(state.card.keywords).toEqual([]);
      expect(state.card.affinities).toEqual([]);
      expect(() => engine.addAbility(state)).not.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
