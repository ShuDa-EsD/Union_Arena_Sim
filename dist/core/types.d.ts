export type CardType = 'Character' | 'Site' | 'Event' | 'AP';
export type GamePhase = 'Setup' | 'Start' | 'Movement' | 'Main' | 'Attack' | 'End' | 'GameOver';
export type Zone = 'Deck' | 'Hand' | 'FrontLine' | 'EnergyLine' | 'LifeArea' | 'ApArea' | 'Sideline' | 'RemovalArea';
export type FieldState = 'Active' | 'Resting';
export type GameEventType = 'GameStarted' | 'TurnStarted' | 'PhaseChanged' | 'TurnEnded' | 'GameEnded' | 'CardPlayed' | 'CardSidelined' | 'CardMovedToZone' | 'AttackDeclared' | 'BlockDeclared' | 'BattleResolved' | 'BattleWon' | 'BattleLost' | 'DamageDealt' | 'LifeCardRevealed' | 'TriggerChecked' | 'TriggerActivated' | 'AbilityActivated' | 'AbilityResolved' | 'StateChanged';
export interface AbilityData {
    abilityId: string;
    timing: string;
    condition?: Record<string, any>;
    costs: Array<{
        costType: string;
        params?: Record<string, any>;
    }>;
    effects: Array<{
        effectType: string;
        params?: Record<string, any>;
    }>;
    isOptional: boolean;
}
export interface RaidData {
    targetSpecifier: {
        type: 'Name' | 'Affinity';
        value: string;
    };
    raidAbilities: AbilityData[];
}
export interface CardData {
    cardId: string;
    cardName: string;
    cardType: CardType;
    sourceMaterial: string;
    affinities: string[];
    requiredEnergy: {
        color: string;
        amount: number;
    };
    apCost: number;
    bp?: {
        base: number;
    };
    energyGeneration?: Array<{
        color: string;
        amount: number;
    }>;
    abilities: AbilityData[];
    trigger?: AbilityData;
    raid?: RaidData;
    keywords: string[];
}
export interface CardInZone {
    cardId: string;
    instanceId: string;
    ownerId: string;
    faceUp: boolean;
}
export interface CardOnField extends CardInZone {
    state: FieldState;
    currentBP: number;
    raidedBy: string | null;
    raiding: string | null;
}
export interface PlayerState {
    playerId: string;
    playerOrder: 'PlayerOne' | 'PlayerTwo';
    deck: CardInZone[];
    hand: CardInZone[];
    frontLine: CardOnField[];
    energyLine: CardOnField[];
    lifeArea: CardInZone[];
    apArea: CardOnField[];
    sideline: CardInZone[];
    removalArea: CardInZone[];
    energyPool: Record<string, number>;
    availableAP: number;
}
export interface GameState {
    gameId: string;
    phase: GamePhase;
    turnNumber: number;
    currentPlayerId: string;
    players: Record<string, PlayerState>;
    battleState: BattleState | null;
    stateVersion: number;
    winner: string | null;
}
export interface GameEvent {
    eventType: GameEventType;
    sourcePlayerId?: string;
    sourceCardInstanceId?: string;
    data: Record<string, any>;
}
export type ActionType = 'PlayCharacter' | 'PlaySite' | 'UseEvent' | 'PerformRaid' | 'ActivateAbility' | 'MoveCharacter' | 'DeclareAttack' | 'DeclareBlock' | 'ActivateTrigger' | 'ExtraDraw' | 'EndMainPhase' | 'EndAttackPhase' | 'MulliganDecision';
export interface ActionRequest {
    actionType: ActionType;
    playerId: string;
    cardInstanceId?: string;
    targetInstanceId?: string;
    targetZone?: Zone;
    abilityId?: string;
}
export interface ActionResult {
    success: boolean;
    error?: string;
    newState: GameState;
    events: GameEvent[];
    log: string[];
}
export interface CardRegistry {
    byId: Map<string, CardData>;
    all: CardData[];
}
export interface AbilityInstance {
    instanceId: string;
    abilityData: AbilityData;
    sourceCardInstanceId: string;
    sourcePlayerId: string;
    isTrigger: boolean;
}
export type BattleStep = 'Idle' | 'AttackerDeclaration' | 'BlockerDeclaration' | 'Resolving' | 'Ending';
export interface BattleState {
    step: BattleStep;
    attacker: {
        cardInstanceId: string;
        bpAtDeclaration: number;
    };
    target: {
        type: 'Player' | 'Character';
        playerId: string;
        characterInstanceId?: string;
    };
    blocker: {
        cardInstanceId: string;
        bpAtDeclaration: number;
    } | null;
    isSnipe: boolean;
    damageDealt: number;
}
export type StateChange = {
    type: 'MOVE_CARD';
    instanceId: string;
    from: Zone;
    to: Zone;
    playerId: string;
} | {
    type: 'SET_FIELD_STATE';
    instanceId: string;
    state: FieldState;
    playerId: string;
} | {
    type: 'UPDATE_BP';
    instanceId: string;
    delta: number;
    playerId: string;
} | {
    type: 'ADJUST_AP';
    playerId: string;
    delta: number;
} | {
    type: 'DRAW_CARD';
    playerId: string;
    count: number;
} | {
    type: 'SHUFFLE_DECK';
    playerId: string;
};
//# sourceMappingURL=types.d.ts.map