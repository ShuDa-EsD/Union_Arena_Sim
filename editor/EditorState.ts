// ============================================================================
// Union Arena Digital — Card Editor: EditorState (Batch 7.1)
// ============================================================================
// 编辑器内部状态：正在编辑的卡牌 + undo/redo 快照栈 + dirty 追踪。
// 纯数据与纯函数，不依赖任何 UI / DOM / 网络。
// ============================================================================

import { CardData } from '../src/core/types';

export interface EditorState {
  /** 当前正在编辑的卡牌数据（与 CardData 对齐）。 */
  card: CardData;
  /** true = 新建卡牌（尚未保存过）；false = 从已有卡牌加载。 */
  isNew: boolean;
  /** 来源文件路径（loadFromFile / saveToFile 时填充）。 */
  sourceFile?: string;
  /** 最近一次保存/加载时的快照；null 表示从未保存（新建卡）。 */
  savedSnapshot: CardData | null;
  /** 撤销栈（不含当前状态，队尾为最近一次编辑前的快照）。 */
  undoStack: CardData[];
  /** 重做栈。 */
  redoStack: CardData[];
  /** 当前卡牌相对 savedSnapshot 是否有未保存改动。 */
  dirty: boolean;
}

/**
 * 通用深拷贝（卡牌数据均为 JSON 可序列化，JSON 往返即可实现深拷贝，
 * 同时会丢弃值为 undefined 的键）。
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 深拷贝一张卡牌。 */
export function cloneCard(card: CardData): CardData {
  return deepClone(card);
}

/**
 * 深度相等比较（对象键序无关，数组有序）。用于 dirty 判定与 undo/redo 回退比较。
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  if (Array.isArray(aObj) || Array.isArray(bObj)) {
    if (!Array.isArray(aObj) || !Array.isArray(bObj)) return false;
    if (aObj.length !== bObj.length) return false;
    for (let i = 0; i < aObj.length; i++) {
      if (!deepEqual(aObj[i], bObj[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!(key in bObj)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

/**
 * 计算 dirty 标记：新建卡（savedSnapshot === null）永远视为未保存。
 */
export function computeDirty(card: CardData, savedSnapshot: CardData | null): boolean {
  if (savedSnapshot === null) return true;
  return !deepEqual(card, savedSnapshot);
}
