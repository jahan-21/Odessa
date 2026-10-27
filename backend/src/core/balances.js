/**
 * CampusSplit Financial Core — Balance Calculation Engine
 *
 * Computes individual and group financial positions from validated expenses
 * and settlement transactions, enforcing the zero-sum conservation invariant
 * and generating explainable breakdowns.
 */

const { formatRupees, paiseToRupees } = require('./money');

/**
 * Calculates net balances, contributions, and residual balances for all participants.
 *
 * @param {Array<{ _id: string, name: string }>} participants
 * @param {Array<any>} expenses - Validated expense records
 * @param {Array<any>} settlements - Active (non-reversed) settlement records
 * @returns {object} Aggregated balance sheet and invariant verification report
 */
function calculateEventBalances(participants = [], expenses = [], settlements = []) {
  const participantMap = new Map();

  // Initialize participant records
  for (const p of participants) {
    const id = String(p._id || p.id);
    participantMap.set(id, {
      participantId: id,
      participantName: p.name || 'Unnamed Participant',
      totalPaidPaise: 0,
      totalSharePaise: 0,
      netBalancePaise: 0,
      settlementPaidPaise: 0,       // Payments made as debtor
      settlementReceivedPaise: 0,   // Payments received as creditor
      residualBalancePaise: 0,
      status: 'SETTLED',
      paidExpenses: [],
      sharedExpenses: []
    });
  }

  // 1. Process Expenses: Aggregate Total Paid & Shares
  let totalEventExpenditurePaise = 0;

  for (const expense of expenses) {
    const amount = expense.amountPaise;
    totalEventExpenditurePaise += amount;

    const payerId = String(expense.payerId?._id || expense.payerId);
    const payerRecord = participantMap.get(payerId);
    if (payerRecord) {
      payerRecord.totalPaidPaise += amount;
      payerRecord.paidExpenses.push({
        expenseId: String(expense._id || expense.id),
        description: expense.description,
        amountPaise: amount,
        splitMethod: expense.splitMethod,
        category: expense.category,
        createdAt: expense.createdAt
      });
    }

    // Accumulate beneficiary shares
    for (const b of expense.beneficiaries || []) {
      const benId = String(b.participantId?._id || b.participantId);
      const benRecord = participantMap.get(benId);
      if (benRecord) {
        benRecord.totalSharePaise += b.sharePaise;
        benRecord.sharedExpenses.push({
          expenseId: String(expense._id || expense.id),
          description: expense.description,
          totalExpensePaise: amount,
          sharePaise: b.sharePaise,
          splitMethod: expense.splitMethod,
          category: expense.category,
          createdAt: expense.createdAt
        });
      }
    }
  }

  // 2. Process Settlements: Adjust for completed payments
  for (const settlement of settlements) {
    // Only count active completed settlements
    if (settlement.status && settlement.status !== 'COMPLETED') {
      continue;
    }

    const payerId = String(settlement.payerId?._id || settlement.payerId); // Debtor
    const payeeId = String(settlement.payeeId?._id || settlement.payeeId); // Creditor
    const amount = settlement.amountPaise;

    const debtor = participantMap.get(payerId);
    const creditor = participantMap.get(payeeId);

    if (debtor) {
      debtor.settlementPaidPaise += amount;
    }
    if (creditor) {
      creditor.settlementReceivedPaise += amount;
    }
  }

  // 3. Compute Net Balances, Residual Balances, and Status
  let sumNetBalancesPaise = 0;
  let sumResidualBalancesPaise = 0;
  const balancesList = [];

  for (const record of participantMap.values()) {
    record.netBalancePaise = record.totalPaidPaise - record.totalSharePaise;
    sumNetBalancesPaise += record.netBalancePaise;

    // Residual Balance = Net Balance + (Settlements Paid) - (Settlements Received)
    // For a debtor (net < 0): paying X adds +X towards 0
    // For a creditor (net > 0): receiving X subtracts X towards 0
    record.residualBalancePaise = record.netBalancePaise + record.settlementPaidPaise - record.settlementReceivedPaise;
    sumResidualBalancesPaise += record.residualBalancePaise;

    // Determine status based on residual balance
    if (record.residualBalancePaise > 0) {
      record.status = 'CREDITOR'; // Should receive money
    } else if (record.residualBalancePaise < 0) {
      record.status = 'DEBTOR';   // Owes money
    } else {
      record.status = 'SETTLED';
    }

    // Format human-friendly rupee strings
    record.totalPaidRupees = formatRupees(record.totalPaidPaise);
    record.totalShareRupees = formatRupees(record.totalSharePaise);
    record.netBalanceRupees = formatRupees(record.netBalancePaise, true);
    record.residualBalanceRupees = formatRupees(record.residualBalancePaise, true);

    balancesList.push(record);
  }

  // 4. Verify Conservation Invariants
  const isNetBalanced = sumNetBalancesPaise === 0;
  const isResidualBalanced = sumResidualBalancesPaise === 0;

  if (!isNetBalanced) {
    throw new Error(
      `Financial Invariant Violation: Sum of participant net balances is non-zero (${sumNetBalancesPaise} paise). Total expenditure does not reconcile with total shares.`
    );
  }
  if (!isResidualBalanced) {
    throw new Error(
      `Financial Invariant Violation: Sum of participant residual balances is non-zero (${sumResidualBalancesPaise} paise). Settlement ledger has leaked funds.`
    );
  }

  return {
    totalExpenseAmountPaise: totalEventExpenditurePaise,
    totalExpenseAmountRupees: formatRupees(totalEventExpenditurePaise),
    balances: balancesList,
    verification: {
      sumOfNetBalancesPaise: sumNetBalancesPaise,
      sumOfResidualBalancesPaise: sumResidualBalancesPaise,
      isReconciled: isNetBalanced && isResidualBalanced,
      totalParticipants: participants.length,
      totalExpensesCount: expenses.length,
      totalSettlementsCount: settlements.filter(s => !s.status || s.status === 'COMPLETED').length
    }
  };
}

/**
 * Generates a step-by-step explainability summary for a specific participant.
 *
 * @param {object} participantBalanceRecord
 * @returns {object} Detailed explanation
 */
function generateParticipantExplanation(record) {
  const {
    participantName,
    totalPaidPaise,
    totalSharePaise,
    netBalancePaise,
    residualBalancePaise,
    settlementPaidPaise,
    settlementReceivedPaise,
    paidExpenses,
    sharedExpenses
  } = record;

  const paidRupees = formatRupees(totalPaidPaise);
  const shareRupees = formatRupees(totalSharePaise);
  const netRupees = formatRupees(netBalancePaise, true);
  const residualRupees = formatRupees(residualBalancePaise, true);

  let narrative = '';
  if (netBalancePaise > 0) {
    narrative = `${participantName} paid ${paidRupees} in total, but their personal share of group expenses was only ${shareRupees}. Therefore, ${participantName} is a creditor and is entitled to receive ${netRupees.replace('+', '')} from the group.`;
  } else if (netBalancePaise < 0) {
    narrative = `${participantName} paid ${paidRupees} in total, while their personal share of group expenses was ${shareRupees}. Therefore, ${participantName} is a debtor and owes ${formatRupees(Math.abs(netBalancePaise))} to the group.`;
  } else {
    narrative = `${participantName}'s total payments (${paidRupees}) exactly match their incurred shares (${shareRupees}). Their financial position is completely balanced.`;
  }

  if (settlementPaidPaise > 0 || settlementReceivedPaise > 0) {
    const settledDiff = settlementPaidPaise - settlementReceivedPaise;
    narrative += ` After accounting for recorded settlement transfers (${settlementPaidPaise > 0 ? `paid ${formatRupees(settlementPaidPaise)}` : ''} ${settlementReceivedPaise > 0 ? `received ${formatRupees(settlementReceivedPaise)}` : ''}), their remaining outstanding balance is ${residualRupees}.`;
  }

  return {
    participantId: record.participantId,
    participantName,
    narrative,
    formula: `Net Balance = Total Paid (${paidRupees}) - Total Share (${shareRupees}) = ${netRupees}`,
    summary: {
      totalPaidPaise,
      totalPaidRupees: paidRupees,
      totalSharePaise,
      totalShareRupees: shareRupees,
      netBalancePaise,
      netBalanceRupees: netRupees,
      settlementPaidPaise,
      settlementReceivedPaise,
      residualBalancePaise,
      residualBalanceRupees: residualRupees
    },
    paidExpensesBreakdown: paidExpenses,
    sharedExpensesBreakdown: sharedExpenses
  };
}

module.exports = {
  calculateEventBalances,
  generateParticipantExplanation
};
