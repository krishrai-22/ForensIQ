/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { runClassifierUnitTests } from './__tests__/classify.test.ts';

const results = runClassifierUnitTests();
let allPassed = true;

console.log('================================================================');
console.log('FIELDTEST COMPANION &bull; DETERMINISTIC CLASSIFIER UNIT TESTS');
console.log('================================================================');

for (const r of results) {
  if (r.passed) {
    console.log(`[PASS] ${r.testName}`);
  } else {
    allPassed = false;
    console.error(`[FAIL] ${r.testName}: ${r.details}`);
  }
}

console.log('================================================================');
console.log(`Total: ${results.length} | Passed: ${results.filter((r) => r.passed).length} | Failed: ${results.filter((r) => !r.passed).length}`);
console.log('================================================================');

if (!allPassed) {
  process.exit(1);
}
