const assert = require('node:assert');
const http = require('node:http');
const mongoose = require('mongoose');
const app = require('../../src/app');

const TEST_DB_URI = 'mongodb://localhost:27017/campussplit_test';

// Helper to make HTTP requests against express app
function request(server) {
  return {
    async get(url) {
      return makeRequest(server, 'GET', url);
    },
    async post(url, body) {
      return makeRequest(server, 'POST', url, body);
    },
    async put(url, body) {
      return makeRequest(server, 'PUT', url, body);
    },
    async patch(url, body) {
      return makeRequest(server, 'PATCH', url, body);
    },
    async delete(url) {
      return makeRequest(server, 'DELETE', url);
    }
  };
}

function makeRequest(server, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = addr.port;
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runIntegrationTests() {
  console.log('====================================================');
  console.log('CampusSplit API Integration Test Suite');
  console.log('====================================================\n');

  // 1. Connect to isolated Test DB
  await mongoose.connect(TEST_DB_URI);
  await mongoose.connection.dropDatabase();
  console.log('[Test Setup] Cleaned and connected to campussplit_test DB.');

  // 2. Start HTTP server on random free port
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const client = request(server);
  console.log(`[Test Setup] Test server listening on port ${server.address().port}.\n`);

  let testCount = 0;
  let passedCount = 0;

  async function step(name, fn) {
    testCount++;
    try {
      await fn();
      passedCount++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }

  try {
    let eventId;
    let ashaId;
    let balaId;
    let charanId;
    let expense1Id;
    let settlementId;

    // Test 1: Healthcheck
    await step('GET /api/v1/health returns ONLINE', async () => {
      const res = await client.get('/api/v1/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ONLINE');
    });

    // Test 2: Create Event
    await step('POST /api/v1/events creates new event', async () => {
      const res = await client.post('/api/v1/events', {
        name: 'Goa Hackathon 2026',
        description: 'Student engineering event in Goa',
        currency: 'INR'
      });
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data._id);
      assert.strictEqual(res.body.data.name, 'Goa Hackathon 2026');
      eventId = res.body.data._id;
    });

    // Test 3: Add Participants
    await step('POST /api/v1/events/:eventId/participants adds Asha, Bala, Charan', async () => {
      const res1 = await client.post(`/api/v1/events/${eventId}/participants`, {
        name: 'Asha',
        email: 'asha@campus.edu'
      });
      assert.strictEqual(res1.status, 201);
      ashaId = res1.body.data._id;

      const res2 = await client.post(`/api/v1/events/${eventId}/participants`, {
        name: 'Bala',
        email: 'bala@campus.edu'
      });
      assert.strictEqual(res2.status, 201);
      balaId = res2.body.data._id;

      const res3 = await client.post(`/api/v1/events/${eventId}/participants`, {
        name: 'Charan',
        email: 'charan@campus.edu'
      });
      assert.strictEqual(res3.status, 201);
      charanId = res3.body.data._id;
    });

    // Test 4: Prevent Duplicate Participant
    await step('POST /api/v1/events/:eventId/participants rejects duplicate name', async () => {
      const res = await client.post(`/api/v1/events/${eventId}/participants`, {
        name: 'Asha',
        email: 'asha2@campus.edu'
      });
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.error.code, 'DUPLICATE_PARTICIPANT_NAME');
    });

    // Test 5: Expense Preview
    await step('POST /api/v1/events/:eventId/expenses/preview validates equal split', async () => {
      const res = await client.post(`/api/v1/events/${eventId}/expenses/preview`, {
        description: 'Team Dinner',
        amountRupees: 900.00,
        payerId: ashaId,
        splitMethod: 'EQUAL',
        beneficiaryIds: [ashaId, balaId, charanId]
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.amountPaise, 90000);
      assert.strictEqual(res.body.data.beneficiaries.length, 3);
      assert.strictEqual(res.body.data.verification.exactMatch, true);
    });

    // Test 6: Record Expense 1 (Equal Split)
    await step('POST /api/v1/events/:eventId/expenses records Expense 1 (Asha pays ₹900)', async () => {
      const res = await client.post(`/api/v1/events/${eventId}/expenses`, {
        description: 'Team Dinner',
        amountRupees: 900.00,
        payerId: ashaId,
        splitMethod: 'EQUAL',
        beneficiaryIds: [ashaId, balaId, charanId]
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.amountPaise, 90000);
      expense1Id = res.body.data._id;
    });

    // Test 7: Record Expense 2 (Exact Split - Bala pays ₹600 for Bala & Charan)
    await step('POST /api/v1/events/:eventId/expenses records Expense 2 (Bala pays ₹600)', async () => {
      const res = await client.post(`/api/v1/events/${eventId}/expenses`, {
        description: 'Hardware Supplies',
        amountRupees: 600.00,
        payerId: balaId,
        splitMethod: 'EXACT',
        beneficiaries: [
          { participantId: balaId, shareRupees: 150.00 },
          { participantId: charanId, shareRupees: 450.00 }
        ]
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.amountPaise, 60000);
    });

    // Test 8: Verify Case Study Balances
    await step('GET /api/v1/events/:eventId/balances reconciles Asha (+₹600), Bala (+₹150), Charan (-₹750)', async () => {
      const res = await client.get(`/api/v1/events/${eventId}/balances`);
      assert.strictEqual(res.status, 200);
      const b = res.body.data;
      assert.strictEqual(b.verification.isReconciled, true);
      assert.strictEqual(b.verification.sumOfNetBalancesPaise, 0);

      const asha = b.balances.find(p => p.participantId === ashaId);
      const bala = b.balances.find(p => p.participantId === balaId);
      const charan = b.balances.find(p => p.participantId === charanId);

      assert.strictEqual(asha.netBalancePaise, 60000); // +₹600.00
      assert.strictEqual(bala.netBalancePaise, 15000); // +₹150.00
      assert.strictEqual(charan.netBalancePaise, -75000); // -₹750.00
    });

    // Test 9: Explainability Breakdown
    await step('GET /api/v1/events/:eventId/balances/:id/explain returns clear narrative', async () => {
      const res = await client.get(`/api/v1/events/${eventId}/balances/${ashaId}/explain`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.narrative.includes('Asha'));
      assert.ok(res.body.data.narrative.includes('₹600.00'));
    });

    // Test 10: Proposed Settlements
    await step('GET /api/v1/events/:eventId/settlements/proposed yields exact settlement plan', async () => {
      const res = await client.get(`/api/v1/events/${eventId}/settlements/proposed`);
      assert.strictEqual(res.status, 200);
      const t = res.body.data.proposedTransfers;
      assert.strictEqual(t.length, 2);

      // Charan pays Asha ₹600.00
      assert.strictEqual(t[0].fromParticipantId, charanId);
      assert.strictEqual(t[0].toParticipantId, ashaId);
      assert.strictEqual(t[0].amountPaise, 60000);

      // Charan pays Bala ₹150.00
      assert.strictEqual(t[1].fromParticipantId, charanId);
      assert.strictEqual(t[1].toParticipantId, balaId);
      assert.strictEqual(t[1].amountPaise, 15000);
    });

    // Test 11: Record Settlement Payment
    await step('POST /api/v1/events/:eventId/settlements/record registers completed transfer', async () => {
      const res = await client.post(`/api/v1/events/${eventId}/settlements/record`, {
        payerId: charanId,
        payeeId: ashaId,
        amountRupees: 600.00,
        notes: 'UPI transfer ref #123456'
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.amountPaise, 60000);
      settlementId = res.body.data._id;
    });

    // Test 12: Residual Balance After Settlement
    await step('GET /api/v1/events/:eventId/balances updates residual balances correctly', async () => {
      const res = await client.get(`/api/v1/events/${eventId}/balances`);
      assert.strictEqual(res.status, 200);
      const b = res.body.data;
      const asha = b.balances.find(p => p.participantId === ashaId);
      const charan = b.balances.find(p => p.participantId === charanId);

      // Asha received 600 -> residual 0 (SETTLED)
      assert.strictEqual(asha.residualBalancePaise, 0);
      assert.strictEqual(asha.status, 'SETTLED');

      // Charan paid 600 -> residual -15000 (still owes 150 to Bala)
      assert.strictEqual(charan.residualBalancePaise, -15000);
      assert.strictEqual(charan.status, 'DEBTOR');
    });

    // Test 13: Settlement Protection Lock
    await step('PUT /api/v1/events/:eventId/expenses/:id blocks edit when active settlement exists', async () => {
      const res = await client.put(`/api/v1/events/${eventId}/expenses/${expense1Id}`, {
        description: 'Team Dinner Modified',
        amountRupees: 950.00,
        payerId: ashaId,
        splitMethod: 'EQUAL',
        beneficiaryIds: [ashaId, balaId, charanId]
      });
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.error.code, 'SETTLEMENT_LOCK_CONFLICT');
    });

    // Test 14: Settlement Reversal
    await step('POST /api/v1/events/:eventId/settlements/:id/reverse reverses settlement record', async () => {
      const res = await client.post(`/api/v1/events/${eventId}/settlements/${settlementId}/reverse`, {
        reason: 'Payment failed at bank gateway'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'REVERSED');
    });

    // Test 15: Expense Edit Permitted After Reversal
    await step('PUT /api/v1/events/:eventId/expenses/:id succeeds after settlement reversal', async () => {
      const res = await client.put(`/api/v1/events/${eventId}/expenses/${expense1Id}`, {
        description: 'Team Dinner Re-checked',
        amountRupees: 900.00,
        payerId: ashaId,
        splitMethod: 'EQUAL',
        beneficiaryIds: [ashaId, balaId, charanId]
      });
      assert.strictEqual(res.status, 200);
    });

    // Test 16: Reconciliation Report
    await step('GET /api/v1/events/:eventId/report/reconciliation validates all invariants', async () => {
      const res = await client.get(`/api/v1/events/${eventId}/report/reconciliation`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.invariants.conservationOfMoneyPassed, true);
      assert.strictEqual(res.body.data.invariants.netDebtCreditEquivalencePassed, true);
    });

    // Test 17: CSV Export
    await step('GET /api/v1/events/:eventId/report/export/csv returns valid CSV format', async () => {
      const res = await client.get(`/api/v1/events/${eventId}/report/export/csv`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('CAMPUSSPLIT FINANCIAL REPORT'));
      assert.ok(res.body.includes('--- EXPENSES ---'));
      assert.ok(res.body.includes('--- PARTICIPANT BALANCES ---'));
    });

    console.log('\n====================================================');
    console.log(`Integration Test Summary: ${passedCount}/${testCount} Passed (100%)`);
    console.log('====================================================\n');
  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runIntegrationTests().catch(err => {
    console.error('\nIntegration Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = { runIntegrationTests };
