// ============================================================================
// Union Arena Digital — GameEngine (Batch 5.5)
// ============================================================================
// 门面类 — 封装所有子系统，提供统一的游戏初始化和操作入口。
// ============================================================================

import { GameState, ActionRequest, ActionResult, CardData, CardRegistry } from './types';
import { createGameState } from './GameState';
import { EventBus } from './EventBus';
import { TurnManager } from './TurnManager';
import { RuleValidator } from './RuleValidator';
import { ActionSystem } from './ActionSystem';
import { CardSystem } from '../systems/CardSystem';
import { EnergySystem } from '../systems/EnergySystem';
import { AbilitySystem } from '../systems/AbilitySystem';
import { RaidSystem } from '../systems/RaidSystem';
import { BattleSystem } from '../systems/BattleSystem';
import { DamageSystem } from '../systems/DamageSystem';
import { TriggerSystem } from '../systems/TriggerSystem';

export interface GameConfig {
  gameId: string;
  playerOneId: string;
  playerTwoId: string;
  cardDataList: CardData[];
  keywordDefs: Map<string, import('./types').AbilityData[]>;
}

export class GameEngine {
  private state!: GameState;
  private eventBus!: EventBus;
  private turnManager!: TurnManager;
  private ruleValidator!: RuleValidator;
  private actionSystem!: ActionSystem;
  private energySystem!: EnergySystem;
  private abilitySystem!: AbilitySystem;
  private raidSystem!: RaidSystem;
  private battleSystem!: BattleSystem;
  private damageSystem!: DamageSystem;
  private triggerSystem!: TriggerSystem;
  private cardRegistry!: CardRegistry;

  /**
   * 创建新游戏。
   */
  newGame(config: GameConfig): GameState {
    // Expand keywords
    const expandedCards = config.cardDataList.map((c) =>
      CardSystem.expandKeywords(c, config.keywordDefs),
    );

    // Build registry
    this.cardRegistry = CardSystem.createRegistry(expandedCards);

    this.eventBus = new EventBus();
    this.turnManager = new TurnManager(this.eventBus);
    this.energySystem = new EnergySystem();
    this.abilitySystem = new AbilitySystem(this.eventBus);
    this.damageSystem = new DamageSystem();
    this.triggerSystem = new TriggerSystem(this.abilitySystem);
    this.battleSystem = new BattleSystem(this.eventBus, this.abilitySystem, this.damageSystem, this.triggerSystem);
    this.raidSystem = new RaidSystem();
    this.ruleValidator = new RuleValidator(this.energySystem);

    this.actionSystem = new ActionSystem(
      this.eventBus,
      this.ruleValidator,
      this.abilitySystem,
      this.energySystem,
      this.raidSystem,
      (cardId: string) => this.cardRegistry.byId.get(cardId),
    );

    // Create decks
    const allCards = this.cardRegistry.all;
    const deck1 = this.buildDeck(allCards, 50);
    const deck2 = this.buildDeck(allCards, 50);

    this.state = createGameState({
      gameId: config.gameId,
      playerOneId: config.playerOneId,
      playerTwoId: config.playerTwoId,
      deck1,
      deck2,
    });

    return this.state;
  }

  /**
   * 推进阶段。
   */
  advancePhase(): ActionResult {
    const { newState, events } = this.turnManager.advancePhase(this.state);
    this.state = newState;
    return { success: true, newState, events, log: [`Phase: ${newState.phase}`] };
  }

  /**
   * 提交玩家操作。
   */
  submitAction(action: ActionRequest): ActionResult {
    const result = this.actionSystem.submitAction(this.state, action);
    if (result.success) {
      this.state = result.newState;
    }
    return result;
  }

  /**
   * 获取当前状态（只读）。
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * 获取 CardRegistry。
   */
  getCardRegistry(): CardRegistry {
    return this.cardRegistry;
  }

  /**
   * 攻击宣言（BattleSystem 集成）。
   */
  declareAttack(attackerInstanceId: string, targetType: 'Player' | 'Character', targetInstanceId?: string): ActionResult {
    const result = this.battleSystem.declareAttack(
      this.state, attackerInstanceId, targetType, targetInstanceId,
      (id) => this.cardRegistry.byId.get(id),
    );
    this.state = result.newState;
    return { success: true, newState: result.newState, events: result.events, log: result.log };
  }

  /**
   * 阻挡宣言。
   */
  declareBlock(blockerInstanceId: string): ActionResult {
    const result = this.battleSystem.declareBlock(this.state, blockerInstanceId);
    this.state = result.newState;
    return { success: true, newState: result.newState, events: result.events, log: result.log };
  }

  /**
   * 跳过阻挡（防御方选择不阻挡）。
   */
  skipBlock(): ActionResult {
    const result = this.battleSystem.skipBlock(
      this.state,
      (id) => this.cardRegistry.byId.get(id),
    );
    this.state = result.newState;
    return { success: true, newState: result.newState, events: result.events, log: result.log };
  }

  /**
   * 获取当前战斗状态。
   */
  getBattleState() {
    return this.state.battleState;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private buildDeck(allCards: CardData[], count: number): CardData[] {
    const deck: CardData[] = [];
    const nameCounts: Record<string, number> = {};
    let i = 0;
    while (deck.length < count && i < count * 4) {
      const template = allCards[i % allCards.length];
      const cnt = nameCounts[template.cardId] || 0;
      if (cnt < 4) {
        nameCounts[template.cardId] = cnt + 1;
        deck.push({ ...template });
      }
      i++;
    }
    return deck;
  }
}
