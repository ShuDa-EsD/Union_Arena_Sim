// ============================================================================
// Union Arena Digital — Card Creator CLI (Batch 7.3)
// ============================================================================
// 交互式卡牌创建向导（readline）。只负责收集用户输入，
// 全部编辑/验证/预览/保存逻辑复用 CardEditorEngine → CardSystem。
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { AbilityData, CardType, RaidData } from '../../src/core/types';
import { CardSystem } from '../../src/systems/CardSystem';
import { CardEditorEngine, DEFAULT_CUSTOM_DIR } from '../CardEditorEngine';
import { EditorState } from '../EditorState';
import { CARD_TYPES, ENERGY_COLORS } from '../CardSchema';

const KEYWORDS_FILE = path.resolve(__dirname, '..', '..', 'src', 'data', 'keywords', 'keyword_definitions.json');
const TEST_SET_DIR = path.resolve(__dirname, '..', '..', 'src', 'data', 'cards', 'test_set');

/** 加载引擎 + 可用关键词名（单一数据源：keyword_definitions.json）。 */
export function loadContext(): { engine: CardEditorEngine; keywords: string[] } {
  const keywordDefs = CardSystem.loadKeywordDefinitions(KEYWORDS_FILE);
  const engine = new CardEditorEngine(keywordDefs);
  const keywords = Array.from(keywordDefs.keys()).sort();
  return { engine, keywords };
}

/** CLI 收集的答案集合（可测试的纯数据）。 */
export interface CreatorAnswers {
  cardType: CardType;
  cardId: string;
  cardName: string;
  sourceMaterial: string;
  affinities?: string[];
  requiredEnergyColor: string;
  requiredEnergyAmount: number;
  apCost: number;
  bpBase?: number;
  energyGeneration?: Array<{ color: string; amount: number }>;
  abilities?: AbilityData[];
  trigger?: AbilityData | null;
  raid?: RaidData | null;
  keywords?: string[];
}

/**
 * 将一组答案应用到新模板，返回 EditorState。
 * 全程只调用 CardEditorEngine 方法，不重写任何验证/展开逻辑。
 */
export function applyAnswers(engine: CardEditorEngine, answers: CreatorAnswers): EditorState {
  let state = engine.createTemplate(answers.cardType);
  state = engine.updateField(state, 'cardId', answers.cardId);
  state = engine.updateField(state, 'cardName', answers.cardName);
  state = engine.updateField(state, 'sourceMaterial', answers.sourceMaterial);
  state = engine.updateField(state, 'affinities', answers.affinities ?? []);
  state = engine.updateField(state, 'requiredEnergy.color', answers.requiredEnergyColor);
  state = engine.updateField(state, 'requiredEnergy.amount', answers.requiredEnergyAmount);
  state = engine.updateField(state, 'apCost', answers.apCost);

  if (answers.cardType === 'Character') {
    state = engine.updateField(state, 'bp.base', answers.bpBase ?? 3000);
    state = engine.updateField(state, 'energyGeneration', answers.energyGeneration ?? [{ color: '白', amount: 1 }]);
  } else if (answers.cardType === 'Site') {
    state = engine.updateField(state, 'energyGeneration', answers.energyGeneration ?? [{ color: '白', amount: 1 }]);
  }

  if (answers.abilities) {
    for (const ability of answers.abilities) state = engine.addAbility(state, ability);
  }
  if (answers.keywords) {
    for (const keyword of answers.keywords) state = engine.toggleKeyword(state, keyword);
  }
  if (answers.trigger) state = engine.setTrigger(state, answers.trigger);
  if (answers.raid) state = engine.setRaid(state, answers.raid);
  return state;
}

// ===== 交互辅助 =====

type PromptFn = (prompt: string) => Promise<string>;

/**
 * 基于 readline 的提问器。对到达的行做缓冲，使交互式问答在 TTY 与
 * 管道（非交互）输入下都能可靠工作。
 */
function createPrompt(rl: readline.Interface): PromptFn {
  const queue: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  rl.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else queue.push(line);
  });
  return (prompt: string) => {
    process.stdout.write(prompt);
    if (queue.length > 0) return Promise.resolve(queue.shift() as string);
    return new Promise((resolve) => waiters.push(resolve));
  };
}

async function askChoice(ask: PromptFn, prompt: string, options: string[]): Promise<string> {
  for (;;) {
    const answer = (await ask(prompt)).trim();
    if (options.includes(answer)) return answer;
    console.log(`  Please choose one of: ${options.join(' / ')}`);
  }
}

async function askNumber(ask: PromptFn, prompt: string, min?: number, max?: number): Promise<number> {
  for (;;) {
    const raw = (await ask(prompt)).trim();
    const n = Number(raw);
    const ok = !Number.isNaN(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
    if (ok) return n;
    const range = min !== undefined || max !== undefined ? ` (${min ?? '-∞'} ~ ${max ?? '∞'})` : '';
    console.log(`  Please enter a valid number${range}.`);
  }
}

async function askYesNo(ask: PromptFn, prompt: string): Promise<boolean> {
  const a = (await ask(prompt)).trim().toLowerCase();
  return a === 'y' || a === 'yes';
}

async function askJson(ask: PromptFn, prompt: string, fallback: unknown): Promise<any> {
  const raw = (await ask(prompt)).trim();
  if (raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    console.log('  Invalid JSON, using fallback.');
    return fallback;
  }
}

// ===== 交互式创建流程 =====

async function runInteractive(engine: CardEditorEngine, keywords: string[]): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = createPrompt(rl);

  console.log('\nCard Creator — Create a new Union Arena card');
  console.log('=============================================\n');

  const cardType = (await askChoice(ask, `Card type (${CARD_TYPES.join('/')}): `, CARD_TYPES)) as CardType;
  const cardId = (await ask('Card ID (e.g. HTR-1-021): ')).trim();
  const cardName = (await ask('Card Name: ')).trim();
  const sourceMaterial = (await ask('Source Material: ')).trim();
  const affinitiesRaw = (await ask('Affinities (comma-separated, empty for none): ')).trim();
  const affinities = affinitiesRaw === '' ? [] : affinitiesRaw.split(',').map((s) => s.trim()).filter(Boolean);

  const energyColor = await askChoice(ask, `Required Energy Color (${ENERGY_COLORS.join('/')}): `, ENERGY_COLORS);
  const energyAmount = await askNumber(ask, 'Required Energy Amount: ', 0);
  const apCost = await askNumber(ask, 'AP Cost: ', 0);

  let bpBase: number | undefined;
  let energyGeneration: Array<{ color: string; amount: number }> | undefined;
  if (cardType === 'Character') {
    bpBase = await askNumber(ask, 'Base BP (> 0): ', 1);
    const genColor = await askChoice(ask, `Energy Generation Color (${ENERGY_COLORS.join('/')}): `, ENERGY_COLORS);
    const genAmount = await askNumber(ask, 'Energy Generation Amount: ', 0);
    energyGeneration = [{ color: genColor, amount: genAmount }];
  } else if (cardType === 'Site') {
    const genColor = await askChoice(ask, `Energy Generation Color (${ENERGY_COLORS.join('/')}): `, ENERGY_COLORS);
    const genAmount = await askNumber(ask, 'Energy Generation Amount: ', 0);
    energyGeneration = [{ color: genColor, amount: genAmount }];
  }

  // 能力（循环添加）
  const abilities: AbilityData[] = [];
  let idx = 1;
  while (await askYesNo(ask, `Add ability #${idx}? (y/n): `)) {
    const timing = (await ask('  Timing (e.g. WhenPlayed/ActivateMain): ')).trim() || 'WhenPlayed';
    const effects = await askJson(ask, '  Effects (JSON array, e.g. [{"effectType":"DrawCard","params":{"count":1}}]): ', []);
    const costs = await askJson(ask, '  Costs (JSON array): ', []);
    const isOptional = await askYesNo(ask, '  Optional? (y/n): ');
    abilities.push({ abilityId: `ABL-${idx}`, timing, costs, effects, isOptional });
    idx++;
  }

  // 关键词
  console.log(`\n  Available keywords: ${keywords.join(', ') || '(none)'}`);
  const kwRaw = (await ask('Keywords (comma-separated, empty for none): ')).trim();
  const selectedKeywords = kwRaw === '' ? [] : kwRaw.split(',').map((s) => s.trim()).filter(Boolean);

  // Trigger
  let trigger: AbilityData | null = null;
  if (await askYesNo(ask, 'Add Trigger? (y/n): ')) {
    const effects = await askJson(ask, '  Trigger Effects (JSON array): ', []);
    trigger = { abilityId: 'TRIG-1', timing: 'Trigger', costs: [], effects, isOptional: true };
  }

  // Raid
  let raid: RaidData | null = null;
  if (await askYesNo(ask, 'Add Raid? (y/n): ')) {
    const type = (await askChoice(ask, '  Target type (Name/Affinity): ', ['Name', 'Affinity'])) as 'Name' | 'Affinity';
    const value = (await ask('  Target value: ')).trim();
    const raidAbilities = await askJson(ask, '  raidAbilities (JSON array): ', []);
    raid = { targetSpecifier: { type, value }, raidAbilities };
  }

  const state = applyAnswers(engine, {
    cardType, cardId, cardName, sourceMaterial, affinities,
    requiredEnergyColor: energyColor, requiredEnergyAmount: energyAmount, apCost,
    bpBase, energyGeneration, abilities, trigger, raid, keywords: selectedKeywords,
  });

  // 预览 + 验证（复用 CardSystem）
  const expanded = engine.previewExpansion(state);
  console.log('\n--- Preview ---');
  console.log(`  ${state.card.cardId} "${state.card.cardName}"  ${state.card.cardType}  ${state.card.requiredEnergy.color}×${state.card.requiredEnergy.amount}  AP:${state.card.apCost}${state.card.bp ? `  BP:${state.card.bp.base}` : ''}`);
  if (state.card.keywords.length) console.log(`  [${state.card.keywords.join(', ')}]`);
  for (const ability of expanded.abilities) {
    const fx = ability.effects.map((e) => e.effectType).join(', ') || '(no effects)';
    console.log(`  ${ability.timing}: ${fx}`);
  }
  if (expanded.trigger) console.log(`  Trigger: ${expanded.trigger.timing}`);

  const validation = engine.validate(state);
  console.log('\n--- Validation ---');
  if (validation.valid) {
    console.log('  ✅ Valid');
  } else {
    validation.errors.forEach((e) => console.log(`  ❌ ${e}`));
  }

  // 保存（复用 saveToFile → 写 custom/）
  if (await askYesNo(ask, '\nSave to file? (y/n): ')) {
    try {
      const saved = engine.saveToFile(state);
      console.log(`  ✅ Card saved to ${saved.sourceFile}`);
    } catch (e) {
      console.log(`  ❌ Save failed: ${(e as Error).message}`);
    }
  } else {
    console.log('  (not saved)');
  }

  rl.close();
}

// ===== 非交互模式 =====

function validateAll(): void {
  const dirs = [DEFAULT_CUSTOM_DIR, TEST_SET_DIR];
  let total = 0;
  let failed = 0;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      total++;
      const card = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const result = CardSystem.validateCard(card);
      if (!result.valid) {
        failed++;
        console.log(`❌ ${file}: ${result.errors.join('; ')}`);
      }
    }
  }
  console.log(`\n${total} cards checked, ${failed} invalid.`);
}

async function runCli(): Promise<void> {
  const [flag, value] = process.argv.slice(2);
  const { engine, keywords } = loadContext();

  if (flag === '--export-template') {
    const type = value as CardType;
    if (!type || !CARD_TYPES.includes(type)) {
      console.error('Usage: npm run card-creator -- --export-template <Character|Site|Event|AP>');
      process.exit(1);
    }
    console.log(JSON.stringify(engine.exportCard(engine.createTemplate(type)), null, 2));
    return;
  }

  if (flag === '--validate-all') {
    validateAll();
    return;
  }

  await runInteractive(engine, keywords);
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
