// ============================================================================
// Union Arena Digital — Card Editor: CardSchema (Batch 7.1)
// ============================================================================
// 卡牌字段元数据：驱动表单渲染 + 提供每卡牌类型的模板结构。
// 字段适用性（cardTypes）与 CardSystem.validateCard() 的约束保持一致。
// ============================================================================

import { CardData, CardType } from '../src/core/types';

export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'tags'
  | 'energy-list'
  | 'ability-list'
  | 'ability'
  | 'raid';

export interface FieldValidation {
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface CardFieldSchema {
  /** 对应 CardData 的键路径（支持点号嵌套，如 'bp.base'）。 */
  fieldKey: string;
  /** 显示名称。 */
  label: string;
  /** 输入控件类型。 */
  type: FieldType;
  /** 是否必填。 */
  required: boolean;
  /** 适用的卡牌类型。 */
  cardTypes: CardType[];
  /** 前端即时校验规则。 */
  validation?: FieldValidation;
  /** 模板默认值。 */
  defaultValue?: unknown;
}

export const CARD_TYPES: CardType[] = ['Character', 'Site', 'Event', 'AP'];

export const ENERGY_COLORS: string[] = ['白', '红', '蓝', '绿', '紫', '黄'];

const ALL_TYPES: CardType[] = ['Character', 'Site', 'Event', 'AP'];
const CHARACTER_AND_SITE: CardType[] = ['Character', 'Site'];
const ABILITY_TYPES: CardType[] = ['Character', 'Site', 'Event'];

export const CARD_FIELDS: CardFieldSchema[] = [
  { fieldKey: 'cardId', label: 'Card ID', type: 'text', required: true, cardTypes: ALL_TYPES },
  { fieldKey: 'cardName', label: 'Card Name', type: 'text', required: true, cardTypes: ALL_TYPES },
  {
    fieldKey: 'cardType',
    label: 'Card Type',
    type: 'select',
    required: true,
    cardTypes: ALL_TYPES,
    validation: { options: CARD_TYPES },
  },
  { fieldKey: 'sourceMaterial', label: 'Source Material', type: 'text', required: true, cardTypes: ALL_TYPES },
  { fieldKey: 'affinities', label: 'Affinities', type: 'tags', required: false, cardTypes: ALL_TYPES },
  {
    fieldKey: 'requiredEnergy.color',
    label: 'Required Energy Color',
    type: 'select',
    required: true,
    cardTypes: ALL_TYPES,
    validation: { options: ENERGY_COLORS },
  },
  {
    fieldKey: 'requiredEnergy.amount',
    label: 'Required Energy Amount',
    type: 'number',
    required: true,
    cardTypes: ALL_TYPES,
    validation: { min: 0, max: 10 },
  },
  {
    fieldKey: 'apCost',
    label: 'AP Cost',
    type: 'number',
    required: true,
    cardTypes: ALL_TYPES,
    validation: { min: 0 },
  },
  {
    fieldKey: 'bp.base',
    label: 'Base BP',
    type: 'number',
    required: true,
    cardTypes: ['Character'],
    validation: { min: 500, max: 15000, step: 500 },
    defaultValue: 3000,
  },
  {
    fieldKey: 'energyGeneration',
    label: 'Energy Generation',
    type: 'energy-list',
    required: true,
    cardTypes: CHARACTER_AND_SITE,
  },
  { fieldKey: 'abilities', label: 'Abilities', type: 'ability-list', required: false, cardTypes: ABILITY_TYPES },
  { fieldKey: 'trigger', label: 'Trigger', type: 'ability', required: false, cardTypes: ABILITY_TYPES },
  { fieldKey: 'raid', label: 'Raid', type: 'raid', required: false, cardTypes: ['Character'] },
  { fieldKey: 'keywords', label: 'Keywords', type: 'tags', required: false, cardTypes: ABILITY_TYPES },
];

export function getFieldsForCardType(cardType: CardType): CardFieldSchema[] {
  return CARD_FIELDS.filter((f) => f.cardTypes.includes(cardType));
}

export function getField(fieldKey: string): CardFieldSchema | undefined {
  return CARD_FIELDS.find((f) => f.fieldKey === fieldKey);
}

/**
 * 生成某卡牌类型的空白模板（结构完整，身份类字段留空待填写）。
 * 结构必须与 CardSystem.validateCard() 兼容：即便留空也包含全部必填键。
 */
export function createTemplateCard(cardType: CardType): CardData {
  const base: CardData = {
    cardId: '',
    cardName: '',
    cardType,
    sourceMaterial: '',
    affinities: [],
    requiredEnergy: { color: '', amount: 0 },
    apCost: 0,
    abilities: [],
    keywords: [],
  };

  if (cardType === 'Character') {
    return { ...base, bp: { base: 3000 }, energyGeneration: [{ color: '白', amount: 1 }] };
  }
  if (cardType === 'Site') {
    return { ...base, energyGeneration: [{ color: '白', amount: 1 }] };
  }
  // Event 与 AP 结构相同：仅通用字段。
  return { ...base };
}
