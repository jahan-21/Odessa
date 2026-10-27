const Event = require('../models/Event');
const Participant = require('../models/Participant');
const Expense = require('../models/Expense');
const SettlementRecord = require('../models/SettlementRecord');
const { getEventBalances } = require('./balanceService');
const { formatRupees, paiseToRupees } = require('../core/money');
const { AppError } = require('../middleware/errorHandler');

/**
 * Generates an event-wide reconciliation report validating all mathematical invariants.
 */
async function getReconciliationReport(eventId) {
  const event = await Event.findById(eventId).lean();
  if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

  const balanceSheet = await getEventBalances(eventId);
  const settlements = await SettlementRecord.find({ eventId }).lean();

  const totalCompletedSettlementsPaise = settlements
    .filter(s => s.status === 'COMPLETED')
    .reduce((acc, s) => acc + s.amountPaise, 0);

  const totalReversedSettlementsPaise = settlements
    .filter(s => s.status === 'REVERSED')
    .reduce((acc, s) => acc + s.amountPaise, 0);

  const totalNetDebtPaise = balanceSheet.balances
    .filter(b => b.netBalancePaise < 0)
    .reduce((acc, b) => acc + Math.abs(b.netBalancePaise), 0);

  const totalNetCreditPaise = balanceSheet.balances
    .filter(b => b.netBalancePaise > 0)
    .reduce((acc, b) => acc + b.netBalancePaise, 0);

  const totalResidualDebtPaise = balanceSheet.balances
    .filter(b => b.residualBalancePaise < 0)
    .reduce((acc, b) => acc + Math.abs(b.residualBalancePaise), 0);

  const totalResidualCreditPaise = balanceSheet.balances
    .filter(b => b.residualBalancePaise > 0)
    .reduce((acc, b) => acc + b.residualBalancePaise, 0);

  return {
    event: {
      id: event._id,
      name: event.name,
      currency: event.currency
    },
    invariants: {
      conservationOfMoneyPassed: balanceSheet.verification.sumOfNetBalancesPaise === 0,
      settlementLedgerConservationPassed: balanceSheet.verification.sumOfResidualBalancesPaise === 0,
      netDebtCreditEquivalencePassed: totalNetDebtPaise === totalNetCreditPaise,
      residualDebtCreditEquivalencePassed: totalResidualDebtPaise === totalResidualCreditPaise
    },
    totals: {
      totalExpenditurePaise: balanceSheet.totalExpenseAmountPaise,
      totalExpenditureRupees: balanceSheet.totalExpenseAmountRupees,
      totalNetDebtPaise,
      totalNetDebtRupees: formatRupees(totalNetDebtPaise),
      totalCompletedSettlementsPaise,
      totalCompletedSettlementsRupees: formatRupees(totalCompletedSettlementsPaise),
      totalRemainingDebtPaise: totalResidualDebtPaise,
      totalRemainingDebtRupees: formatRupees(totalResidualDebtPaise)
    },
    participantCount: balanceSheet.balances.length,
    expenseCount: balanceSheet.verification.totalExpensesCount,
    settlementCount: settlements.length
  };
}

/**
 * Generates CSV export for expenses, balances, and settlements.
 */
async function exportEventCSV(eventId) {
  const event = await Event.findById(eventId).lean();
  if (!event) throw new AppError('Event not found.', 404, 'NOT_FOUND');

  const [expenses, balanceSheet, settlements] = await Promise.all([
    Expense.find({ eventId })
      .sort({ createdAt: 1 })
      .populate('payerId', 'name')
      .populate('beneficiaries.participantId', 'name')
      .lean(),
    getEventBalances(eventId),
    SettlementRecord.find({ eventId })
      .sort({ createdAt: 1 })
      .populate('payerId', 'name')
      .populate('payeeId', 'name')
      .lean()
  ]);

  const lines = [];

  // 1. Event Meta
  lines.push(`CAMPUSSPLIT FINANCIAL REPORT: ${event.name}`);
  lines.push(`Exported At,${new Date().toISOString()}`);
  lines.push(`Currency,${event.currency}`);
  lines.push('');

  // 2. Expenses Section
  lines.push('--- EXPENSES ---');
  lines.push('Expense ID,Date,Description,Category,Split Method,Payer,Amount (INR),Beneficiaries');
  for (const exp of expenses) {
    const benStr = (exp.beneficiaries || [])
      .map(b => `${b.participantId?.name || 'Unknown'}: ₹${(b.sharePaise / 100).toFixed(2)}`)
      .join('; ');
    const desc = `"${(exp.description || '').replace(/"/g, '""')}"`;
    lines.push(
      `${exp._id},${new Date(exp.createdAt).toLocaleDateString()},${desc},${exp.category},${exp.splitMethod},"${exp.payerId?.name || 'Unknown'}",${(exp.amountPaise / 100).toFixed(2)},"${benStr}"`
    );
  }
  lines.push('');

  // 3. Balances Section
  lines.push('--- PARTICIPANT BALANCES ---');
  lines.push('Participant,Total Paid (INR),Total Share (INR),Net Balance (INR),Residual Balance (INR),Status');
  for (const b of balanceSheet.balances) {
    lines.push(
      `"${b.participantName}",${(b.totalPaidPaise / 100).toFixed(2)},${(b.totalSharePaise / 100).toFixed(2)},${(b.netBalancePaise / 100).toFixed(2)},${(b.residualBalancePaise / 100).toFixed(2)},${b.status}`
    );
  }
  lines.push('');

  // 4. Settlements Section
  lines.push('--- SETTLEMENT LEDGER ---');
  lines.push('Settlement ID,Date,Payer (Debtor),Payee (Creditor),Amount (INR),Status,Reversal Reason');
  for (const s of settlements) {
    lines.push(
      `${s._id},${new Date(s.createdAt).toLocaleDateString()},"${s.payerId?.name || 'Unknown'}","${s.payeeId?.name || 'Unknown'}",${(s.amountPaise / 100).toFixed(2)},${s.status},"${(s.reversalReason || '').replace(/"/g, '""')}"`
    );
  }

  return lines.join('\n');
}

module.exports = {
  getReconciliationReport,
  exportEventCSV
};
