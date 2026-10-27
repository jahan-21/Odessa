const Participant = require('../models/Participant');
const Expense = require('../models/Expense');
const SettlementRecord = require('../models/SettlementRecord');
const { calculateEventBalances, generateParticipantExplanation } = require('../core/balances');
const { AppError } = require('../middleware/errorHandler');

async function getEventBalances(eventId) {
  const [participants, expenses, settlements] = await Promise.all([
    Participant.find({ eventId }).lean(),
    Expense.find({ eventId }).lean(),
    SettlementRecord.find({ eventId, status: 'COMPLETED' }).lean()
  ]);

  try {
    const balanceSheet = calculateEventBalances(participants, expenses, settlements);
    return balanceSheet;
  } catch (err) {
    throw new AppError(err.message, 500, 'CALCULATION_ERROR');
  }
}

async function explainParticipantBalance(eventId, participantId) {
  const [participants, expenses, settlements] = await Promise.all([
    Participant.find({ eventId }).lean(),
    Expense.find({ eventId }).lean(),
    SettlementRecord.find({ eventId, status: 'COMPLETED' }).lean()
  ]);

  const balanceSheet = calculateEventBalances(participants, expenses, settlements);
  const participantRecord = balanceSheet.balances.find(
    b => String(b.participantId) === String(participantId)
  );

  if (!participantRecord) {
    throw new AppError('Participant not found in this event balance sheet.', 404, 'NOT_FOUND');
  }

  return generateParticipantExplanation(participantRecord);
}

module.exports = {
  getEventBalances,
  explainParticipantBalance
};
