// ============================================================================
// Union Arena Digital — MVP Entry Point
// ============================================================================

import { runBasicGame } from './scenarios/scenario_basic_game';

console.log('Union Arena Digital MVP v0.1.0');
console.log('================================\n');

const scenario = process.argv[2] || 'basic_game';

switch (scenario) {
  case 'basic_game':
    runBasicGame();
    break;
  default:
    console.log(`Unknown scenario: ${scenario}`);
    console.log('Available: basic_game');
}

console.log('\nDone.');
