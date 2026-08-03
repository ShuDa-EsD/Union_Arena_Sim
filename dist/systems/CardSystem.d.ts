import { CardData, CardRegistry, AbilityData } from '../core/types';
export declare class CardSystem {
    /**
     * 从目录加载所有 .json 卡牌文件。
     */
    static loadCardsFromDirectory(dirPath: string): CardData[];
    /**
     * 验证单张卡牌数据完整性。
     */
    static validateCard(card: Record<string, any>): {
        valid: boolean;
        errors: string[];
    };
    /**
     * 加载关键词定义文件。
     */
    static loadKeywordDefinitions(filePath: string): Map<string, AbilityData[]>;
    /**
     * 展开卡牌的关键词为等效能力条目。
     * 关键词展开后的能力追加到 abilities[] 末尾。
     * 不修改原 CardData 对象。
     */
    static expandKeywords(card: CardData, keywordDefs: Map<string, AbilityData[]>): CardData;
    /**
     * 构建卡牌注册表。
     */
    static createRegistry(cards: CardData[]): CardRegistry;
}
//# sourceMappingURL=CardSystem.d.ts.map