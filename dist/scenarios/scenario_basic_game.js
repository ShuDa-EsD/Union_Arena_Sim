"use strict";
// ============================================================================
// Scenario: Basic Game
// ============================================================================
// 模拟一局最小可玩对战：
//   双方出牌 → Battle → Damage → Ability/Trigger → 胜负判定
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBasicGame = runBasicGame;
const GameEngine_1 = require("../core/GameEngine");
const CardSystem_1 = require("../systems/CardSystem");
const idgen_1 = require("../utils/idgen");
const path = __importStar(require("path"));
// ============================================================================
// Setup helpers
// ============================================================================
/** Add energy cards to a player's energy line (direct state setup). */
function setupEnergy(state, playerId, color, count) {
    const player = state.players[playerId];
    for (let i = 0; i < count; i++) {
        player.energyLine.push({
            cardId: 'HTR-1-005',
            instanceId: (0, idgen_1.generateInstanceId)(),
            ownerId: playerId,
            faceUp: true,
            state: 'Resting',
            currentBP: 0,
            raidedBy: null,
            raiding: null,
        });
    }
}
/** Add a character to a player's front line (direct state setup). */
function addCharacterToFrontLine(state, playerId, cardId, bp, fieldState = 'Active') {
    const instanceId = (0, idgen_1.generateInstanceId)();
    state.players[playerId].frontLine.push({
        cardId, instanceId, ownerId: playerId,
        faceUp: true,
        state: fieldState,
        currentBP: bp,
        raidedBy: null,
        raiding: null,
    });
    return instanceId;
}
/** Add a card to hand. Returns instanceId. */
function addToHand(state, playerId, cardId) {
    const instanceId = (0, idgen_1.generateInstanceId)();
    state.players[playerId].hand.push({
        cardId, instanceId, ownerId: playerId, faceUp: false,
    });
    return instanceId;
}
/** Advance to a specific phase. */
function advanceToPhase(engine, target) {
    let state = engine.getState();
    let safety = 0;
    while (state.phase !== target && state.phase !== 'GameOver' && safety < 20) {
        const r = engine.advancePhase();
        state = r.newState;
        safety++;
    }
    return state;
}
/** Advance N phases. */
function advancePhases(engine, n) {
    let state = engine.getState();
    for (let i = 0; i < n; i++) {
        if (state.phase === 'GameOver')
            break;
        state = engine.advancePhase().newState;
    }
    return state;
}
/** Log with prefix. */
function log(msg) {
    console.log(`  ${msg}`);
}
// ============================================================================
// Main scenario
// ============================================================================
function runBasicGame() {
    console.log('═══════════════════════════════════════════');
    console.log('  Union Arena MVP — Basic Game Scenario');
    console.log('═══════════════════════════════════════════\n');
    // ---- Load data (resolve from src/ or dist/) ----
    const baseDir = __dirname.includes('dist')
        ? path.resolve(__dirname, '../../src')
        : path.resolve(__dirname, '..');
    const testSetDir = path.join(baseDir, 'data/cards/test_set');
    const kwPath = path.join(baseDir, 'data/keywords/keyword_definitions.json');
    const cards = CardSystem_1.CardSystem.loadCardsFromDirectory(testSetDir);
    const kwDefs = CardSystem_1.CardSystem.loadKeywordDefinitions(kwPath);
    const engine = new GameEngine_1.GameEngine();
    engine.newGame({
        gameId: 'scenario-1', playerOneId: 'p1', playerTwoId: 'p2',
        cardDataList: cards, keywordDefs: kwDefs,
    });
    let state = engine.getState();
    // ================================================================
    // SETUP: Give both players energy and characters
    // ================================================================
    log('📦 Setup: placing energy and characters...');
    // P1: 3 energy + 1 attacker in hand
    setupEnergy(state, 'p1', '白', 3);
    const p1AttackerId = addToHand(state, 'p1', 'HTR-1-014'); // BP 4000, [Impact 1]
    const p1ScoutId = addToHand(state, 'p1', 'HTR-1-007'); // BP 3000, WhenPlayed: Draw1
    // P2: 3 energy + 1 blocker in hand + 1 front line defender
    setupEnergy(state, 'p2', '白', 3);
    addCharacterToFrontLine(state, 'p2', 'HTR-1-002', 4000, 'Active'); // Existing blocker
    const p2SniperId = addToHand(state, 'p2', 'HTR-1-013'); // BP 3000, [Snipe] + Trigger
    // Ensure at least one Trigger card is near the top of P1's life area (for demo)
    // Find HTR-1-013 in P1's deck/life and move it to position 0 in life area
    const triggerCardInLife = state.players['p1'].lifeArea.find((c) => c.cardId === 'HTR-1-013');
    if (!triggerCardInLife) {
        // Replace last life card with a trigger card
        state.players['p1'].lifeArea[state.players['p1'].lifeArea.length - 1] = {
            cardId: 'HTR-1-013',
            instanceId: (0, idgen_1.generateInstanceId)(),
            ownerId: 'p1',
            faceUp: false,
        };
    }
    log('   📌 Placed HTR-1-013 (Trigger: Draw1) at top of P1 life area');
    // Manually set AP to 3 for both (simulate being in Turn 3+)
    state.players['p1'].apArea = [];
    state.players['p2'].apArea = [];
    for (let i = 0; i < 3; i++) {
        state.players['p1'].apArea.push({
            cardId: 'AP-001', instanceId: (0, idgen_1.generateInstanceId)(), ownerId: 'p1',
            faceUp: true, state: 'Active', currentBP: 0, raidedBy: null, raiding: null,
        });
        state.players['p2'].apArea.push({
            cardId: 'AP-001', instanceId: (0, idgen_1.generateInstanceId)(), ownerId: 'p2',
            faceUp: true, state: 'Active', currentBP: 0, raidedBy: null, raiding: null,
        });
    }
    state.players['p1'].availableAP = 3;
    state.players['p2'].availableAP = 3;
    state.turnNumber = 3; // Simulate Turn 3
    log(`  P1 hand: ${state.players['p1'].hand.length}, energy line: ${state.players['p1'].energyLine.length}`);
    log(`  P2 hand: ${state.players['p2'].hand.length}, energy line: ${state.players['p2'].energyLine.length}`);
    log(`  P2 front line defender: HTR-1-002 (BP 4000, Active)\n`);
    // ================================================================
    // P1 TURN — Main Phase: Play cards
    // ================================================================
    log('══════ P1 Turn (Main Phase) ══════');
    state = advanceToPhase(engine, 'Main');
    if (state.currentPlayerId !== 'p1') {
        // If we're at P2's Main, advance to P1's turn
        state = advancePhases(engine, 4); // End → P1 Start → Movement → Main
    }
    // Ensure we're in Main and it's P1's turn
    if (state.phase !== 'Main' || state.currentPlayerId !== 'p1') {
        state.phase = 'Main';
        state.currentPlayerId = 'p1';
        engine['state'] = state;
    }
    // P1 plays HTR-1-007 (WhenPlayed: Draw 1)
    log('▶  P1 plays HTR-1-007 "Test Scout" (BP 3000, WhenPlayed: Draw 1)');
    let result = engine.submitAction({
        actionType: 'PlayCharacter', playerId: 'p1',
        cardInstanceId: p1ScoutId, targetZone: 'FrontLine',
    });
    state = result.newState;
    if (result.success) {
        log(`   ✅ Played! Front line: ${state.players['p1'].frontLine.length} card(s)`);
        log(`   📋 WhenPlayed triggered → Draw 1 (hand: ${state.players['p1'].hand.length})`);
        for (const l of result.log)
            log(`   💬 ${l}`);
    }
    else {
        log(`   ❌ Failed: ${result.error}`);
    }
    // P1 plays HTR-1-014 (Impact 1)
    log('▶  P1 plays HTR-1-014 "Test Impactor" (BP 4000, [Impact 1])');
    result = engine.submitAction({
        actionType: 'PlayCharacter', playerId: 'p1',
        cardInstanceId: p1AttackerId, targetZone: 'FrontLine',
    });
    state = result.newState;
    if (result.success) {
        log(`   ✅ Played! Front line: ${state.players['p1'].frontLine.length} card(s)`);
    }
    else {
        log(`   ❌ Failed: ${result.error}`);
    }
    // Switch P1's characters to Active before Attack (simulate Start Phase)
    for (const c of state.players['p1'].frontLine) {
        if (c.state === 'Resting') {
            c.state = 'Active';
        }
    }
    // Directly set Attack phase for P1
    log('\n══════ P1 Attack Phase ══════');
    state.phase = 'Attack';
    state.currentPlayerId = 'p1';
    engine['state'] = state;
    // P1 attacks with first Active character
    const p1Attackers = state.players['p1'].frontLine.filter((c) => c.state === 'Active');
    if (p1Attackers.length > 0) {
        const attacker = p1Attackers[0];
        const attackerData = engine.getCardRegistry().byId.get(attacker.cardId);
        log(`▶  P1 declares attack with "${attackerData?.cardName || attacker.cardId}" (BP ${attacker.currentBP})`);
        const attackResult = engine.declareAttack(attacker.instanceId, 'Player');
        state = attackResult.newState;
        log(`   Battle state: ${state.battleState?.step}`);
        // P2 blocks with HTR-1-002 (Active defender)
        const p2Blockers = state.players['p2'].frontLine.filter((c) => c.state === 'Active');
        if (p2Blockers.length > 0) {
            const blocker = p2Blockers[0];
            const blockerData = engine.getCardRegistry().byId.get(blocker.cardId);
            log(`🛡  P2 blocks with "${blockerData?.cardName || blocker.cardId}" (BP ${blocker.currentBP})`);
            const blockResult = engine.declareBlock(blocker.instanceId);
            state = blockResult.newState;
            const resolveResult = engine.battleSystem.resolveBattle(state, (id) => engine.getCardRegistry().byId.get(id));
            state = resolveResult.newState;
            log(`   ⚔ BP: ${attacker.currentBP} vs ${blocker.currentBP}`);
            for (const l of resolveResult.log)
                log(`   💬 ${l}`);
        }
        else {
            log(`   🛡 P2 cannot block`);
            const skipResult = engine.skipBlock();
            state = skipResult.newState;
            for (const l of skipResult.log)
                log(`   💬 ${l}`);
        }
    }
    else {
        log(`   ⚠ No Active attackers for P1`);
    }
    // ================================================================
    // P2 TURN — Attack Phase
    // ================================================================
    log('\n══════ P2 Attack Phase ══════');
    // Switch P2's characters to Active
    for (const c of state.players['p2'].frontLine) {
        if (c.state === 'Resting') {
            c.state = 'Active';
        }
    }
    // Also switch P1 survivors
    for (const c of state.players['p1'].frontLine) {
        if (c.state === 'Resting') {
            c.state = 'Active';
        }
    }
    state.phase = 'Attack';
    state.currentPlayerId = 'p2';
    state.battleState = null;
    engine['state'] = state;
    const p2Attackers = state.players['p2'].frontLine.filter((c) => c.state === 'Active');
    if (p2Attackers.length > 0) {
        const attacker = p2Attackers[0];
        const attackerData = engine.getCardRegistry().byId.get(attacker.cardId);
        log(`▶  P2 declares attack with "${attackerData?.cardName || attacker.cardId}" (BP ${attacker.currentBP})`);
        const attackResult = engine.declareAttack(attacker.instanceId, 'Player');
        state = attackResult.newState;
        log(`   Battle state: ${state.battleState?.step}`);
        // P1 block?
        const p1Blockers = state.players['p1'].frontLine.filter((c) => c.state === 'Active');
        if (p1Blockers.length > 0) {
            const blocker = p1Blockers[0];
            log(`🛡  P1 blocks with "${engine.getCardRegistry().byId.get(blocker.cardId)?.cardName || blocker.cardId}" (BP ${blocker.currentBP})`);
            state = engine.declareBlock(blocker.instanceId).newState;
            const resolveResult = engine.battleSystem.resolveBattle(state, (id) => engine.getCardRegistry().byId.get(id));
            state = resolveResult.newState;
            log(`   ⚔ BP: ${attacker.currentBP} vs ${blocker.currentBP}`);
            for (const l of resolveResult.log)
                log(`   💬 ${l}`);
        }
        else {
            log(`   🛡 P1 cannot block → Direct damage!`);
            const skipResult = engine.skipBlock();
            state = skipResult.newState;
            for (const l of skipResult.log)
                log(`   💬 ${l}`);
            for (const e of skipResult.events) {
                if (e.eventType === 'TriggerActivated')
                    log(`   ⚡ Trigger activated!`);
                if (e.eventType === 'TriggerChecked')
                    log(`   🔍 Trigger check...`);
            }
        }
        log(`   ❤ P1 Life: ${state.players['p1'].lifeArea.length}/7`);
        log(`   ❤ P2 Life: ${state.players['p2'].lifeArea.length}/7`);
    }
    // ================================================================
    // Continue battles until game over (alternate turns, max 20 battles)
    // ================================================================
    log('\n══════ Continuing battles... ══════');
    let battleCount = 0;
    const maxBattles = 20;
    while (state.phase !== 'GameOver' && battleCount < maxBattles) {
        const cp = state.currentPlayerId;
        const opponentId = cp === 'p1' ? 'p2' : 'p1';
        // Refresh all chars to Active (simulate new turn)
        for (const c of state.players['p1'].frontLine) {
            if (c.state === 'Resting' && !c.raidedBy) {
                c.state = 'Active';
            }
        }
        for (const c of state.players['p2'].frontLine) {
            if (c.state === 'Resting' && !c.raidedBy) {
                c.state = 'Active';
            }
        }
        state.phase = 'Attack';
        state.battleState = null;
        engine['state'] = state;
        const attackers = state.players[cp].frontLine.filter((c) => c.state === 'Active');
        if (attackers.length === 0) {
            // Switch to other player
            state.currentPlayerId = opponentId;
            engine['state'] = state;
            battleCount++;
            continue;
        }
        const attacker = attackers[0];
        const attackResult = engine.declareAttack(attacker.instanceId, 'Player');
        state = attackResult.newState;
        if (state.battleState?.step === 'BlockerDeclaration') {
            const defenders = state.players[opponentId].frontLine.filter((c) => c.state === 'Active');
            if (defenders.length > 0) {
                // Block
                state = engine.declareBlock(defenders[0].instanceId).newState;
                const resolveResult = engine.battleSystem.resolveBattle(state, (id) => engine.getCardRegistry().byId.get(id));
                state = resolveResult.newState;
                for (const l of resolveResult.log) {
                    if (l.includes('wins') || l.includes('loses') || l.includes('Damage') || l.includes('unblocked')) {
                        log(`   ⚔ ${cp} attack: ${l}`);
                    }
                }
            }
            else {
                // Unblocked → damage
                const skipResult = engine.skipBlock();
                state = skipResult.newState;
                for (const l of skipResult.log) {
                    if (l.includes('Damage') || l.includes('unblocked') || l.includes('wins') || l.includes('loses')) {
                        log(`   ⚔ ${cp} attack: ${l}`);
                    }
                    if (l.includes('Trigger') || l.includes('trigger'))
                        log(`   ⚡ ${l}`);
                }
                for (const e of skipResult.events) {
                    if (e.eventType === 'TriggerActivated')
                        log(`   ⚡ TRIGGER ACTIVATED! ${e.data?.cardId || ''}`);
                    if (e.eventType === 'TriggerChecked')
                        log(`   🔍 Trigger checked: ${e.data?.cardId || ''}`);
                }
            }
        }
        battleCount++;
        // Switch current player for next attack
        state.currentPlayerId = opponentId;
        engine['state'] = state;
        // Check if game should be over
        if (state.players['p1'].lifeArea.length === 0 || state.players['p2'].lifeArea.length === 0) {
            if (state.players['p1'].lifeArea.length === 0) {
                state.winner = 'p2';
            }
            else {
                state.winner = 'p1';
            }
            state.phase = 'GameOver';
            engine['state'] = state;
        }
    }
    // ================================================================
    // Result
    // ================================================================
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  🏁 GAME OVER`);
    console.log(`  Winner: ${state.winner || 'Draw (turn limit)'}`);
    console.log(`  Turns: ${state.turnNumber}, Phase: ${state.phase}`);
    console.log(`  P1 Life: ${state.players['p1'].lifeArea.length}/7`);
    console.log(`  P2 Life: ${state.players['p2'].lifeArea.length}/7`);
    console.log(`  P1 Front Line: ${state.players['p1'].frontLine.length} card(s)`);
    console.log(`  P2 Front Line: ${state.players['p2'].frontLine.length} card(s)`);
    console.log(`═══════════════════════════════════════════\n`);
}
if (require.main === module) {
    runBasicGame();
}
//# sourceMappingURL=scenario_basic_game.js.map