/**
 * CampusSplit Financial Core — Settlement Engine
 *
 * Implements a deterministic greedy matching algorithm to resolve outstanding debts
 * and credits among participants.
 *
 * Algorithm Details:
 * 1. Filter out participants with zero residual balances.
 * 2. Classify into Creditors (balance > 0) and Debtors (balance < 0).
 * 3. Sort Creditors descending by credit; break ties by ascending participant ID.
 * 4. Sort Debtors descending by absolute debt; break ties by ascending participant ID.
 * 5. Greedily match the largest debtor with the largest creditor:
 *    - Transfer T = min(debtor.remainingDebt, creditor.remainingCredit).
 *    - Record proposed transfer: { from: debtor, to: creditor, amountPaise: T }.
 *    - Deduct T from debtor and creditor.
 *    - Advance pointers when balance reaches 0.
 * 6. Execute independent post-condition verification.
 *
 * Time Complexity:
 * - Sorting: O(N log N) where N is number of participants.
 * - Greedy matching: O(N) loop steps (each step eliminates at least one debtor or creditor).
 * - Total Time: O(N log N).
 * - Space Complexity: O(N) auxiliary memory.
 *
 * Optimality Note:
 * This algorithm is guaranteed to settle all balances in at most N - 1 transactions.
 * While greedy matching generates a valid, minimal settlement for the vast majority of
 * real-world distributions, finding the absolute theoretical minimum transaction count
 * across arbitrary multi-party groupings is isomorphic to the NP-hard Subset Sum problem.
 * We prioritize determinism, efficiency, and verifiable correctness.
 */

const { formatRupees } = require('./money');

/**
 * Generates proposed debt settlement transactions for an event.
 *
 * @param {Array<object>} balances - Array of balance records with participantId, participantName, residualBalancePaise
 * @returns {object} Proposed transfers, algorithm metadata, and formal verification report
 */
function generateSettlements(balances = []) {
  // 1. Filter and prepare creditors and debtors
  const creditors = [];
  const debtors = [];

  let totalCreditPaise = 0;
  let totalDebtPaise = 0;

  for (const b of balances) {
    const balance = b.residualBalancePaise !== undefined ? b.residualBalancePaise : b.netBalancePaise;
    const participantId = String(b.participantId || b._id || b.id);
    const participantName = b.participantName || b.name || 'Unknown';

    if (balance > 0) {
      creditors.push({
        participantId,
        participantName,
        creditPaise: balance,
        initialCreditPaise: balance
      });
      totalCreditPaise += balance;
    } else if (balance < 0) {
      const debt = Math.abs(balance);
      debtors.push({
        participantId,
        participantName,
        debtPaise: debt,
        initialDebtPaise: debt
      });
      totalDebtPaise += debt;
    }
  }

  // Pre-condition: Total credit must equal total debt
  if (totalCreditPaise !== totalDebtPaise) {
    throw new Error(
      `Pre-condition Violation in Settlement Engine: Total credit (${totalCreditPaise} paise) does not equal total debt (${totalDebtPaise} paise). Discrepancy: ${totalCreditPaise - totalDebtPaise} paise.`
    );
  }

  // Empty or already-settled group
  if (creditors.length === 0 && debtors.length === 0) {
    return {
      proposedTransfers: [],
      totalSettlementAmountPaise: 0,
      totalSettlementAmountRupees: '₹0.00',
      algorithm: 'Deterministic Greedy Matching',
      timeComplexity: 'O(N log N)',
      isFullySettled: true,
      verification: {
        totalCreditors: 0,
        totalDebtors: 0,
        totalTransactions: 0,
        postConditionsSatisfied: true
      }
    };
  }

  // 2. Deterministic sort: Primary = amount descending; Secondary = participantId ascending
  creditors.sort((a, b) => {
    if (b.creditPaise !== a.creditPaise) {
      return b.creditPaise - a.creditPaise;
    }
    return a.participantId.localeCompare(b.participantId);
  });

  debtors.sort((a, b) => {
    if (b.debtPaise !== a.debtPaise) {
      return b.debtPaise - a.debtPaise;
    }
    return a.participantId.localeCompare(b.participantId);
  });

  // 3. Iterative Greedy Matching
  const proposedTransfers = [];
  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    const amountToTransfer = Math.min(debtor.debtPaise, creditor.creditPaise);

    if (amountToTransfer > 0) {
      proposedTransfers.push({
        fromParticipantId: debtor.participantId,
        fromParticipantName: debtor.participantName,
        toParticipantId: creditor.participantId,
        toParticipantName: creditor.participantName,
        amountPaise: amountToTransfer,
        amountRupees: formatRupees(amountToTransfer)
      });

      debtor.debtPaise -= amountToTransfer;
      creditor.creditPaise -= amountToTransfer;
    }

    if (debtor.debtPaise === 0) {
      debtorIdx++;
    }
    if (creditor.creditPaise === 0) {
      creditorIdx++;
    }
  }

  // 4. Formal Post-Condition Verification
  const verificationReport = verifySettlementPostConditions(balances, proposedTransfers);

  return {
    proposedTransfers,
    totalSettlementAmountPaise: totalCreditPaise,
    totalSettlementAmountRupees: formatRupees(totalCreditPaise),
    algorithm: 'Deterministic Greedy Matching',
    timeComplexity: 'O(N log N)',
    isFullySettled: false,
    verification: verificationReport
  };
}

/**
 * Independent verification function asserting all 4 mathematical invariants of the settlement plan:
 * 1. No debtor pays more than their outstanding debt.
 * 2. No creditor receives more than their outstanding credit.
 * 3. Total proposed payments equal total outstanding debt and credit.
 * 4. Applying proposed payments reduces all balances to zero.
 *
 * @param {Array<object>} originalBalances
 * @param {Array<object>} transfers
 * @returns {object}
 */
function verifySettlementPostConditions(originalBalances, transfers) {
  const simBalances = new Map();
  const originalDebtMap = new Map();
  const originalCreditMap = new Map();

  for (const b of originalBalances) {
    const id = String(b.participantId || b._id || b.id);
    const bal = b.residualBalancePaise !== undefined ? b.residualBalancePaise : b.netBalancePaise;
    simBalances.set(id, bal);
    if (bal < 0) originalDebtMap.set(id, Math.abs(bal));
    if (bal > 0) originalCreditMap.set(id, bal);
  }

  const debtorPaid = new Map();
  const creditorReceived = new Map();
  let totalTransferPaise = 0;

  for (const t of transfers) {
    if (t.amountPaise <= 0) {
      throw new Error(`Invalid transfer: transfer amount must be > 0. Received ${t.amountPaise}`);
    }

    totalTransferPaise += t.amountPaise;

    debtorPaid.set(t.fromParticipantId, (debtorPaid.get(t.fromParticipantId) || 0) + t.amountPaise);
    creditorReceived.set(t.toParticipantId, (creditorReceived.get(t.toParticipantId) || 0) + t.amountPaise);

    // Simulate transfer
    simBalances.set(t.fromParticipantId, simBalances.get(t.fromParticipantId) + t.amountPaise);
    simBalances.set(t.toParticipantId, simBalances.get(t.toParticipantId) - t.amountPaise);
  }

  // Invariant 1: No debtor overpays
  for (const [id, paid] of debtorPaid.entries()) {
    const initialDebt = originalDebtMap.get(id) || 0;
    if (paid > initialDebt) {
      throw new Error(`Invariant 1 Failed: Debtor "${id}" overpaid. Paid: ${paid}, Debt: ${initialDebt}`);
    }
  }

  // Invariant 2: No creditor receives more than credit
  for (const [id, received] of creditorReceived.entries()) {
    const initialCredit = originalCreditMap.get(id) || 0;
    if (received > initialCredit) {
      throw new Error(`Invariant 2 Failed: Creditor "${id}" over-received. Received: ${received}, Credit: ${initialCredit}`);
    }
  }

  // Invariant 3: Total proposed payments equal total debt/credit
  let totalOriginalDebt = 0;
  for (const d of originalDebtMap.values()) totalOriginalDebt += d;
  if (totalTransferPaise !== totalOriginalDebt) {
    throw new Error(
      `Invariant 3 Failed: Total transferred (${totalTransferPaise}) does not equal total net debt (${totalOriginalDebt})`
    );
  }

  // Invariant 4: All simulated balances must equal 0
  for (const [id, bal] of simBalances.entries()) {
    if (bal !== 0) {
      throw new Error(`Invariant 4 Failed: Participant "${id}" did not settle to 0. Remaining: ${bal} paise.`);
    }
  }

  return {
    postConditionsSatisfied: true,
    totalTransactions: transfers.length,
    totalSettledPaise: totalTransferPaise,
    totalSettledRupees: formatRupees(totalTransferPaise)
  };
}

module.exports = {
  generateSettlements,
  verifySettlementPostConditions
};
