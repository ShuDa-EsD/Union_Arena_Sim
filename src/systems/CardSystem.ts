// ============================================================================
// Union Arena Digital — CardSystem (Batch 1)
// ============================================================================
// 卡牌数据加载、验证、注册。
// B1 不实现关键词展开（B5 加入）。
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { CardData, CardRegistry, AbilityData } from '../core/types';

export class CardSystem {
  /**
   * 从目录加载所有 .json 卡牌文件。
   */
  static loadCardsFromDirectory(dirPath: string): CardData[] {
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
    const cards: CardData[] = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result = CardSystem.validateCard(raw);
      if (!result.valid) {
        throw new Error(
          `Card validation failed for ${file}: ${result.errors.join('; ')}`
        );
      }
      cards.push(raw as CardData);
    }

    return cards;
  }

  /**
   * 验证单张卡牌数据完整性。
   */
  static validateCard(card: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 必填字段
    if (!card.cardId || typeof card.cardId !== 'string') {
      errors.push('cardId is required and must be a string');
    }
    if (!card.cardName || typeof card.cardName !== 'string') {
      errors.push('cardName is required and must be a string');
    }
    if (!card.cardType || !['Character', 'Site', 'Event', 'AP'].includes(card.cardType)) {
      errors.push('cardType must be one of: Character, Site, Event, AP');
    }
    if (!card.sourceMaterial || typeof card.sourceMaterial !== 'string') {
      errors.push('sourceMaterial is required and must be a string');
    }
    if (!Array.isArray(card.affinities)) {
      errors.push('affinities must be an array');
    }
    if (!card.requiredEnergy || typeof card.requiredEnergy.color !== 'string' || typeof card.requiredEnergy.amount !== 'number') {
      errors.push('requiredEnergy must have color (string) and amount (number)');
    }
    if (typeof card.apCost !== 'number' || card.apCost < 0) {
      errors.push('apCost must be a non-negative number');
    }
    if (!Array.isArray(card.abilities)) {
      errors.push('abilities must be an array');
    }
    if (!Array.isArray(card.keywords)) {
      errors.push('keywords must be an array');
    }

    // 类型约束
    if (card.cardType === 'Character') {
      if (!card.bp || typeof card.bp.base !== 'number' || card.bp.base <= 0) {
        errors.push('Character card must have bp.base > 0');
      }
    }

    if (card.cardType === 'Character' || card.cardType === 'Site') {
      if (!Array.isArray(card.energyGeneration) || card.energyGeneration.length === 0) {
        errors.push('Character and Site cards must have energyGeneration array');
      }
    }

    if (card.cardType === 'Event') {
      if (card.bp) {
        errors.push('Event card must not have bp');
      }
    }

    // 能力格式检查
    if (Array.isArray(card.abilities)) {
      for (let i = 0; i < card.abilities.length; i++) {
        const ab = card.abilities[i];
        if (!ab.abilityId) errors.push(`abilities[${i}].abilityId is required`);
        if (!ab.timing) errors.push(`abilities[${i}].timing is required`);
        if (!Array.isArray(ab.costs)) errors.push(`abilities[${i}].costs must be an array`);
        if (!Array.isArray(ab.effects)) errors.push(`abilities[${i}].effects must be an array`);
        if (typeof ab.isOptional !== 'boolean') errors.push(`abilities[${i}].isOptional must be boolean`);
      }
    }

    // Trigger 格式检查
    if (card.trigger) {
      if (!card.trigger.abilityId) errors.push('trigger.abilityId is required');
      if (!card.trigger.timing) errors.push('trigger.timing is required');
    }

    // Raid 格式检查
    if (card.raid) {
      if (!card.raid.targetSpecifier || !card.raid.targetSpecifier.type || !card.raid.targetSpecifier.value) {
        errors.push('raid.targetSpecifier must have type and value');
      }
      if (!Array.isArray(card.raid.raidAbilities)) {
        errors.push('raid.raidAbilities must be an array');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 加载关键词定义文件。
   */
  static loadKeywordDefinitions(filePath: string): Map<string, AbilityData[]> {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const defs = JSON.parse(raw);
    const map = new Map<string, AbilityData[]>();

    for (const [keyword, data] of Object.entries(defs)) {
      const kd = data as { description: string; abilities: AbilityData[] };
      if (Array.isArray(kd.abilities)) {
        map.set(keyword, kd.abilities);
      }
    }

    return map;
  }

  /**
   * 展开卡牌的关键词为等效能力条目。
   * 关键词展开后的能力追加到 abilities[] 末尾。
   * 不修改原 CardData 对象。
   */
  static expandKeywords(card: CardData, keywordDefs: Map<string, AbilityData[]>): CardData {
    if (!card.keywords || card.keywords.length === 0) {
      return card;
    }

    const expandedAbilities = [...card.abilities];

    for (const keyword of card.keywords) {
      const defs = keywordDefs.get(keyword);
      if (defs) {
        expandedAbilities.push(...defs);
      }
    }

    return { ...card, abilities: expandedAbilities };
  }

  /**
   * 构建卡牌注册表。
   */
  static createRegistry(cards: CardData[]): CardRegistry {
    const byId = new Map<string, CardData>();
    for (const card of cards) {
      if (byId.has(card.cardId)) {
        throw new Error(`Duplicate cardId: ${card.cardId}`);
      }
      byId.set(card.cardId, card);
    }
    return { byId, all: [...cards] };
  }
}
