// ============================================================================
// Union Arena Digital — Card Editor: CardEditorEngine (Batch 7.1)
// ============================================================================
// 卡牌编辑器核心引擎（纯逻辑层）：不依赖 DOM / Express / UI。
// 验证复用 CardSystem.validateCard()，关键词展开复用 CardSystem.expandKeywords()。
// 数据格式与 CardData / CardSystem 完全兼容。
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { AbilityData, CardData, CardType, RaidData } from '../src/core/types';
import { CardSystem } from '../src/systems/CardSystem';
import { EditorState, cloneCard, computeDirty, deepClone } from './EditorState';
import { createTemplateCard } from './CardSchema';

/** 自定义卡牌保存目录（与设计文档一致：src/data/cards/custom）。 */
export const DEFAULT_CUSTOM_DIR = path.resolve(__dirname, '..', 'src', 'data', 'cards', 'custom');

const DEFAULT_ABILITY: AbilityData = {
  abilityId: '',
  timing: '',
  costs: [],
  effects: [],
  isOptional: false,
};

/** 按点号路径对 CardData 深拷贝后设置值，返回新对象（不改动原对象）。 */
function setByPath(source: CardData, fieldPath: string, value: unknown): CardData {
  const clone = cloneCard(source) as Record<string, any>;
  const parts = fieldPath.split('.');
  let node: Record<string, any> = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (node[part] === null || node[part] === undefined || typeof node[part] !== 'object') {
      node[part] = {};
    }
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
  return clone as CardData;
}

export class CardEditorEngine {
  private keywordDefs: Map<string, AbilityData[]>;

  constructor(keywordDefs?: Map<string, AbilityData[]>) {
    this.keywordDefs = keywordDefs ?? new Map<string, AbilityData[]>();
  }

  /** 设置关键词定义（供 previewExpansion 复用 CardSystem.expandKeywords）。 */
  setKeywordDefinitions(keywordDefs: Map<string, AbilityData[]>): void {
    this.keywordDefs = keywordDefs;
  }

  // ===== 导入 / 模板 / 导出 =====

  /** 从 CardData 创建编辑器状态（加载已有卡牌）。 */
  importCard(cardData: CardData): EditorState {
    const card = cloneCard(cardData);
    // 归一化可选数组字段：不完整 CardData 若缺 abilities/keywords/affinities
    // （或为非数组），安全兜底为 []，避免后续 addAbility/toggleKeyword 等崩溃。
    const record = card as unknown as Record<string, unknown>;
    if (!Array.isArray(record.abilities)) record.abilities = [];
    if (!Array.isArray(record.keywords)) record.keywords = [];
    if (!Array.isArray(record.affinities)) record.affinities = [];

    return {
      card,
      isNew: false,
      sourceFile: undefined,
      savedSnapshot: cloneCard(card),
      undoStack: [],
      redoStack: [],
      dirty: false,
    };
  }

  /** 从 JSON 文件加载卡牌到编辑器状态。 */
  loadFromFile(filePath: string): EditorState {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CardData;
    const state = this.importCard(raw);
    return { ...state, sourceFile: filePath };
  }

  /** 创建某卡牌类型的空白模板。 */
  createTemplate(cardType: CardType): EditorState {
    const card = createTemplateCard(cardType);
    return {
      card,
      isNew: true,
      sourceFile: undefined,
      savedSnapshot: null,
      undoStack: [],
      redoStack: [],
      dirty: true,
    };
  }

  /** 导出为 CardData（返回深拷贝，避免外部改动内部状态）。 */
  exportCard(state: EditorState): CardData {
    return cloneCard(state.card);
  }

  // ===== 字段编辑 =====

  /** 更新单个字段（支持点号嵌套，如 'bp.base'、'requiredEnergy.color'）。 */
  updateField(state: EditorState, fieldKey: string, value: unknown): EditorState {
    return this.commit(state, setByPath(state.card, fieldKey, value));
  }

  // ===== 能力 CRUD =====

  addAbility(state: EditorState, ability?: AbilityData): EditorState {
    const newAbility = ability
      ? deepClone(ability)
      : { ...DEFAULT_ABILITY, costs: [], effects: [] };
    return this.commit(state, {
      ...state.card,
      abilities: [...state.card.abilities, newAbility],
    });
  }

  updateAbility(state: EditorState, index: number, ability: AbilityData): EditorState {
    if (index < 0 || index >= state.card.abilities.length) {
      throw new Error(`Ability index out of range: ${index}`);
    }
    const abilities = state.card.abilities.slice();
    abilities[index] = deepClone(ability);
    return this.commit(state, { ...state.card, abilities });
  }

  removeAbility(state: EditorState, index: number): EditorState {
    if (index < 0 || index >= state.card.abilities.length) {
      throw new Error(`Ability index out of range: ${index}`);
    }
    const abilities = state.card.abilities.filter((_, i) => i !== index);
    return this.commit(state, { ...state.card, abilities });
  }

  // ===== Raid / Trigger =====

  setRaid(state: EditorState, raid: RaidData | null): EditorState {
    const newCard = cloneCard(state.card);
    if (raid === null) {
      delete newCard.raid;
    } else {
      newCard.raid = deepClone(raid);
    }
    return this.commit(state, newCard);
  }

  setTrigger(state: EditorState, trigger: AbilityData | null): EditorState {
    const newCard = cloneCard(state.card);
    if (trigger === null) {
      delete newCard.trigger;
    } else {
      newCard.trigger = deepClone(trigger);
    }
    return this.commit(state, newCard);
  }

  // ===== 关键词 =====

  toggleKeyword(state: EditorState, keyword: string): EditorState {
    const keywords = state.card.keywords.includes(keyword)
      ? state.card.keywords.filter((k) => k !== keyword)
      : [...state.card.keywords, keyword];
    return this.commit(state, { ...state.card, keywords });
  }

  // ===== 验证 / 预览 =====

  /** 复用 CardSystem.validateCard()：编辑器验证 = 引擎验证。 */
  validate(state: EditorState): { valid: boolean; errors: string[] } {
    return CardSystem.validateCard(state.card);
  }

  /** 复用 CardSystem.expandKeywords()：编辑器预览 = 引擎实际展开。 */
  previewExpansion(state: EditorState): CardData {
    return CardSystem.expandKeywords(state.card, this.keywordDefs);
  }

  // ===== 保存 =====

  /** 计算保存路径（未指定时默认保存到 src/data/cards/custom/<cardId>.json）。 */
  resolveSavePath(state: EditorState, filePath?: string): string {
    return filePath ?? path.join(DEFAULT_CUSTOM_DIR, `${state.card.cardId}.json`);
  }

  /**
   * 保存到 JSON 文件（保存前先 validateCard，无效则抛错）。
   * 成功后返回新状态（dirty=false，savedSnapshot 更新，sourceFile 指向写入路径）。
   */
  saveToFile(state: EditorState, filePath?: string): EditorState {
    const result = this.validate(state);
    if (!result.valid) {
      throw new Error(`Cannot save invalid card: ${result.errors.join('; ')}`);
    }
    const targetPath = this.resolveSavePath(state, filePath);
    const dir = path.dirname(targetPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(state.card, null, 2) + '\n', 'utf-8');
    return {
      ...state,
      sourceFile: targetPath,
      savedSnapshot: cloneCard(state.card),
      dirty: false,
    };
  }

  // ===== Undo / Redo =====

  canUndo(state: EditorState): boolean {
    return state.undoStack.length > 0;
  }

  canRedo(state: EditorState): boolean {
    return state.redoStack.length > 0;
  }

  undo(state: EditorState): EditorState {
    if (!this.canUndo(state)) return state;
    const previous = state.undoStack[state.undoStack.length - 1];
    const undoStack = state.undoStack.slice(0, -1);
    const redoStack = [...state.redoStack, cloneCard(state.card)];
    return {
      ...state,
      card: previous,
      undoStack,
      redoStack,
      dirty: computeDirty(previous, state.savedSnapshot),
    };
  }

  redo(state: EditorState): EditorState {
    if (!this.canRedo(state)) return state;
    const next = state.redoStack[state.redoStack.length - 1];
    const redoStack = state.redoStack.slice(0, -1);
    const undoStack = [...state.undoStack, cloneCard(state.card)];
    return {
      ...state,
      card: next,
      undoStack,
      redoStack,
      dirty: computeDirty(next, state.savedSnapshot),
    };
  }

  // ===== 内部 =====

  /** 将一次编辑固化为新状态：推入撤销快照、清空重做栈、重算 dirty。 */
  private commit(state: EditorState, newCard: CardData): EditorState {
    return {
      ...state,
      card: newCard,
      undoStack: [...state.undoStack, cloneCard(state.card)],
      redoStack: [],
      dirty: computeDirty(newCard, state.savedSnapshot),
    };
  }
}
