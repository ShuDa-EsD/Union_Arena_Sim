// ============================================================================
// 测试卡牌数据工厂 — 快速创建 CardData（不读磁盘）
// ============================================================================

import { CardData } from '../../src/core/types';

let _counter = 0;
function nextId(): number {
  return ++_counter;
}

export function createTestCharacter(overrides: Partial<CardData> = {}): CardData {
  const id = overrides.cardId ?? `TEST-CHAR-${String(nextId()).padStart(3, '0')}`;
  return {
    cardId: id,
    cardName: overrides.cardName || `Test Character ${id}`,
    cardType: 'Character',
    sourceMaterial: overrides.sourceMaterial || 'HTR',
    affinities: overrides.affinities || [],
    requiredEnergy: overrides.requiredEnergy || { color: '白', amount: 1 },
    apCost: overrides.apCost ?? 1,
    bp: overrides.bp || { base: 3000 },
    energyGeneration: overrides.energyGeneration || [{ color: '白', amount: 1 }],
    abilities: overrides.abilities || [],
    trigger: overrides.trigger,
    raid: overrides.raid,
    keywords: overrides.keywords || [],
  };
}

export function createTestSite(overrides: Partial<CardData> = {}): CardData {
  const id = overrides.cardId ?? `TEST-SITE-${String(nextId()).padStart(3, '0')}`;
  return {
    cardId: id,
    cardName: overrides.cardName || `Test Site ${id}`,
    cardType: 'Site',
    sourceMaterial: overrides.sourceMaterial || 'HTR',
    affinities: overrides.affinities || [],
    requiredEnergy: overrides.requiredEnergy || { color: '白', amount: 1 },
    apCost: overrides.apCost ?? 1,
    energyGeneration: overrides.energyGeneration || [{ color: '白', amount: 1 }],
    abilities: overrides.abilities || [],
    trigger: overrides.trigger,
    keywords: overrides.keywords || [],
  };
}

export function createTestEvent(overrides: Partial<CardData> = {}): CardData {
  const id = overrides.cardId ?? `TEST-EVENT-${String(nextId()).padStart(3, '0')}`;
  return {
    cardId: id,
    cardName: overrides.cardName || `Test Event ${id}`,
    cardType: 'Event',
    sourceMaterial: overrides.sourceMaterial || 'HTR',
    affinities: overrides.affinities || [],
    requiredEnergy: overrides.requiredEnergy || { color: '白', amount: 1 },
    apCost: overrides.apCost ?? 1,
    abilities: overrides.abilities || [],
    trigger: overrides.trigger,
    keywords: overrides.keywords || [],
  };
}

/**
 * 创建指定数量的测试卡组（循环使用给定卡牌填充）。
 * 超出同名 4 张限制时自动生成唯一 cardId 后缀。
 */
export function createTestDeck(templateCards: CardData[], targetCount: number = 50): CardData[] {
  const deck: CardData[] = [];
  const nameCounts: Record<string, number> = {};
  let i = 0;
  const maxIterations = targetCount * 4; // 安全上限

  while (deck.length < targetCount && i < maxIterations) {
    const template = templateCards[i % templateCards.length];
    const baseId = template.cardId;

    // 同名卡最多 4 张，超出则加唯一后缀
    const count = nameCounts[baseId] || 0;
    if (count >= 4) {
      const uniqueCard = {
        ...template,
        cardId: `${baseId}-copy-${count - 3}`,
        cardName: `${template.cardName} (Copy ${count - 3})`,
      };
      nameCounts[baseId] = count + 1;
      deck.push(uniqueCard);
    } else {
      nameCounts[baseId] = count + 1;
      deck.push({ ...template });
    }
    i++;
  }

  if (deck.length < targetCount) {
    throw new Error(
      `createTestDeck: could only create ${deck.length}/${targetCount} cards. ` +
      `Provide more template cards or reduce targetCount.`
    );
  }

  return deck;
}
