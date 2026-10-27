const SettlementRecord = require('../models/SettlementRecord');
const Participant = require('../models/Participant');
const { getEventBalances } = require('./balanceService');
const { generateSettlements } = require('../core/settlement');
const { rupeesToPaise, formatRupees } = require('../core/money');
const { logAuditAction } = require('./auditService');
const { AppError } = require('../middleware/errorHandler');

/**
 * Generates algorithmic proposed settlements based on current residual balances.
 */
async function getProposedSettlements(eventId) {
  const balanceSheet = await getEventBalances(eventId);
  const result = generateSettlements(balanceSheet.balances);
  return {
    ...result,
    eventSummary: {
      totalExpenseAmountPaise: balanceSheet.totalExpenseAmountPaise,
      totalExpenseAmountRupees: balanceSheet.totalExpenseAmountRupees
    }
  };
}

/**
 * Records an actual completed settlement payment between two participants.
 */
async function recordSettlement(eventId, data) {
  const { payerId, payeeId, amountRupees, amountPaise: rawPaise, notes } = data;

  if (!payerId || !payeeId) {
    throw new AppError('Both payer (debtor) and payee (creditor) are required.', 400, 'MISSING_PARTIES');
  }

  if (String(payerId) === String(payeeId)) {
    throw new AppError('A participant cannot settle a payment with themselves.', 400, 'SELF_SETTLEMENT');
  }

  let amountPaise;
  if (rawPaise !== undefined && rawPaise !== null) {
    amountPaise = rawPaise;
  } else if (amountRupees !== undefined && amountRupees !== null) {
    amountPaise = rupeesToPaise(amountRupees);
  } else {
    throw new AppError('Settlement amount is required.', 400, 'MISSING_AMOUNT');
  }

  // Validate participants belong to event
  const [payer, payee] = await Promise.all([
    Participant.findOne({ _id: payerId, eventId }),
    Participant.findOne({ _id: payeeId, eventId })
  ]);

  if (!payer || !payee) {
    throw new AppError('Payer or payee does not belong to this event.', 400, 'INVALID_PARTICIPANTS');
  }

  // Verify current residual balances
  const balanceSheet = await getEventBalances(eventId);
  const debtorBal = balanceSheet.balances.find(b => String(b.participantId) === String(payerId));
  const creditorBal = balanceSheet.balances.find(b => String(b.participantId) === String(payeeId));

  if (!debtorBal || debtorBal.residualBalancePaise >= 0) {
    throw new AppError(
      `Participant "${payer.name}" does not currently have an outstanding debt in this event.`,
      400,
      'INVALID_DEBTOR'
    );
  }

  if (!creditorBal || creditorBal.residualBalancePaise <= 0) {
    throw new AppError(
      `Participant "${payee.name}" is not currently owed any money in this event.`,
      400,
      'INVALID_CREDITOR'
    );
  }

  const outstandingDebt = Math.abs(debtorBal.residualBalancePaise);
  if (amountPaise > outstandingDebt) {
    throw new Error(
      `Payment amount (${formatRupees(amountPaise)}) exceeds ${payer.name}'s remaining debt of ${formatRupees(outstandingDebt)}.`
    );
  }

  const outstandingCredit = creditorBal.residualBalancePaise;
  if (amountPaise > outstandingCredit) {
    throw new Error(
      `Payment amount (${formatRupees(amountPaise)}) exceeds ${payee.name}'s remaining credit of ${formatRupees(outstandingCredit)}.`
    );
  }

  const record = new SettlementRecord({
    eventId,
    payerId,
    payeeId,
    amountPaise,
    notes: notes ? notes.trim() : '',
    status: 'COMPLETED'
  });

  await record.save();

  await logAuditAction(eventId, 'SETTLEMENT_RECORDED', 'SettlementRecord', record._id, {
    payerName: payer.name,
    payeeName: payee.name,
    amountPaise,
    amountRupees: formatRupees(amountPaise)
  });

  return record.populate([
    { path: 'payerId', select: 'name email' },
    { path: 'payeeId', select: 'name email' }
  ]);
}

/**
 * Lists all recorded settlements (ledger).
 */
async function listSettlementHistory(eventId) {
  const records = await SettlementRecord.find({ eventId })
    .sort({ createdAt: -1 })
    .populate('payerId', 'name email')
    .populate('payeeId', 'name email')
    .lean();

  return records.map(r => ({
    ...r,
    amountRupees: formatRupees(r.amountPaise)
  }));
}

/**
 * Explicitly reverses a recorded settlement.
 */
async function reverseSettlement(eventId, settlementId, reason) {
  if (!reason || !reason.trim()) {
    throw new AppError('A valid reason is required to reverse a completed settlement.', 400, 'MISSING_REASON');
  }

  const record = await SettlementRecord.findOne({ _id: settlementId, eventId });
  if (!record) {
    throw new AppError('Settlement record not found.', 404, 'NOT_FOUND');
  }

  if (record.status === 'REVERSED') {
    throw new AppError('This settlement record has already been reversed.', 400, 'ALREADY_REVERSED');
  }

  record.status = 'REVERSED';
  record.reversalReason = reason.trim();
  record.reversedAt = new Date();

  await record.save();

  await logAuditAction(eventId, 'SETTLEMENT_REVERSED', 'SettlementRecord', record._id, {
    reversalReason: record.reversalReason,
    amountPaise: record.amountPaise
  });

  return record.populate([
    { path: 'payerId', select: 'name email' },
    { path: 'payeeId', select: 'name email' }
  ]);
}

module.exports = {
  getProposedSettlements,
  recordSettlement,
  listSettlementHistory,
  reverseSettlement
};
