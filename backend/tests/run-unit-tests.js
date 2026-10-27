/**
 * Zero-dependency Unit Test Runner for CampusSplit Financial Core
 * Runs on Node.js 22 built-in primitives.
 */

const assert = require('node:assert');
const path = require('node:path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

// Jest-compatible expect implementation using Node assert
function expect(actual) {
  return {
    toBe(expected) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected) {
      assert.deepStrictEqual(actual, expected);
    },
    toHaveLength(expected) {
      assert.strictEqual(actual.length, expected);
    },
    toContain(expected) {
      assert.ok(
        String(actual).includes(expected),
        `Expected "${actual}" to contain "${expected}"`
      );
    },
    toThrow(pattern) {
      assert.throws(
        () => {
          if (typeof actual === 'function') {
            actual();
          }
        },
        pattern ? (err) => {
          if (pattern instanceof RegExp) {
            return pattern.test(err.message);
          }
          return err.message.includes(pattern);
        } : undefined
      );
    }
  };
}

let currentSuite = '';

function describe(suiteName, fn) {
  const previousSuite = currentSuite;
  currentSuite = previousSuite ? `${previousSuite} > ${suiteName}` : suiteName;
  try {
    fn();
  } finally {
    currentSuite = previousSuite;
  }
}

function test(testName, fn) {
  totalTests++;
  const fullName = `${currentSuite} :: ${testName}`;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${fullName}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${fullName}`);
    console.error(`    ${err.message}`);
    failureDetails.push({ name: fullName, error: err });
  }
}

// Inject globals for test files
global.describe = describe;
global.test = test;
global.it = test;
global.expect = expect;

console.log('====================================================');
console.log('CampusSplit Financial Core — Running Unit Test Suite');
console.log('====================================================\n');

// Load and execute test files
require('./unit/money.test.js');
require('./unit/splits.test.js');
require('./unit/balances.test.js');
require('./unit/settlement.test.js');

console.log('\n====================================================');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed:      ${passedTests}`);
console.log(`Failed:      ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  console.error('\nFailures summary:');
  for (const f of failureDetails) {
    console.error(`- ${f.name}`);
    console.error(`  ${f.error.stack}\n`);
  }
  process.exit(1);
} else {
  console.log('\nALL FINANCIAL CORE UNIT TESTS PASSED WITH 100% INVARIANT CONFORMANCE!\n');
  process.exit(0);
}
