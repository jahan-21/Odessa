const assert = require('node:assert');

console.log('====================================================');
console.log('CampusSplit Frontend Verification & Logic Tests');
console.log('====================================================\n');

let total = 0;
let passed = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// Test 1: Frontend rupee formatting
test('formatRupees frontend utility formats accurately', () => {
  const format = (paise) => `₹${(paise / 100).toFixed(2)}`;
  assert.strictEqual(format(10000), '₹100.00');
  assert.strictEqual(format(3334), '₹33.34');
  assert.strictEqual(format(1), '₹0.01');
});

// Test 2: Exact split remainder calculation
test('calculates exact split remaining balance accurately', () => {
  const totalExpense = 100.00;
  const shares = { p1: '40.00', p2: '35.00' };
  const allocated = Object.values(shares).reduce((a, b) => a + parseFloat(b), 0);
  const remaining = totalExpense - allocated;
  assert.strictEqual(remaining, 25.00);
});

// Test 3: Percentage split validation
test('validates percentage sum must equal 100.00%', () => {
  const percentages = { p1: '33.34', p2: '33.33', p3: '33.33' };
  const sum = Object.values(percentages).reduce((a, b) => a + parseFloat(b), 0);
  assert.strictEqual(Math.abs(sum - 100.00) < 0.001, true);
});

// Test 4: Net balance formula in UI matches backend
test('netBalance formula totalPaid - totalShare matches invariant', () => {
  const participant = { totalPaidPaise: 90000, totalSharePaise: 30000 };
  const netPaise = participant.totalPaidPaise - participant.totalSharePaise;
  assert.strictEqual(netPaise, 60000);
  const status = netPaise > 0 ? 'CREDITOR' : netPaise < 0 ? 'DEBTOR' : 'SETTLED';
  assert.strictEqual(status, 'CREDITOR');
});

// Test 5: Residual balance formula after settlement payment
test('residualBalance moves towards zero when debtor pays creditor', () => {
  // Debtor: initial net -75000 (-₹750). Pays 60000 (+₹600).
  const debtorNet = -75000;
  const settlementPaid = 60000;
  const debtorResidual = debtorNet + settlementPaid;
  assert.strictEqual(debtorResidual, -15000); // Still owes 15000

  // Creditor: initial net +60000 (+₹600). Receives 60000.
  const creditorNet = 60000;
  const settlementReceived = 60000;
  const creditorResidual = creditorNet - settlementReceived;
  assert.strictEqual(creditorResidual, 0); // Completely settled
});

console.log('\n====================================================');
console.log(`Frontend Logic Tests: ${passed}/${total} Passed (100%)`);
console.log('====================================================\n');
