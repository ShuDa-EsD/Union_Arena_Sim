"use strict";
// ============================================================================
// Union Arena Digital — MVP Entry Point
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const scenario_basic_game_1 = require("./scenarios/scenario_basic_game");
console.log('Union Arena Digital MVP v0.1.0');
console.log('================================\n');
const scenario = process.argv[2] || 'basic_game';
switch (scenario) {
    case 'basic_game':
        (0, scenario_basic_game_1.runBasicGame)();
        break;
    default:
        console.log(`Unknown scenario: ${scenario}`);
        console.log('Available: basic_game');
}
console.log('\nDone.');
//# sourceMappingURL=index.js.map