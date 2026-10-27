const Participant = require('../models/Participant');
const Expense = require('../models/Expense');
const SettlementRecord = require('../models/SettlementRecord');
const { logAuditAction } = require('./auditService');
const { AppError } = require('../middleware/errorHandler');

async function addParticipant(eventId, data) {
  const { name, email } = data;
  if (!name || !name.trim()) {
    throw new AppError('Participant name is required.', 400, 'MISSING_NAME');
  }

  const cleanName = name.trim();
  const cleanEmail = email ? email.trim().toLowerCase() : undefined;

  // Check duplicate name within the event
  const existingName = await Participant.findOne({ eventId, name: cleanName });
  if (existingName) {
    throw new AppError(
      `A participant with name "${cleanName}" already exists in this event.`,
      409,
      'DUPLICATE_PARTICIPANT_NAME'
    );
  }

  // Check duplicate email within the event if provided
  if (cleanEmail) {
    const existingEmail = await Participant.findOne({ eventId, email: cleanEmail });
    if (existingEmail) {
      throw new AppError(
        `A participant with email "${cleanEmail}" already exists in this event.`,
        409,
        'DUPLICATE_PARTICIPANT_EMAIL'
      );
    }
  }

  const participant = new Participant({
    eventId,
    name: cleanName,
    email: cleanEmail
  });

  await participant.save();
  await logAuditAction(eventId, 'PARTICIPANT_ADDED', 'Participant', participant._id, {
    name: cleanName
  });

  return participant;
}

async function listParticipants(eventId, includeInactive = false) {
  const query = { eventId };
  if (!includeInactive) {
    query.status = 'ACTIVE';
  }
  return Participant.find(query).sort({ name: 1 }).lean();
}

/**
 * Safely deactivates or removes a participant.
 * If the participant has any financial history (expenses or settlements),
 * physical deletion is prevented and status is set to INACTIVE.
 */
async function deactivateParticipant(eventId, participantId) {
  const participant = await Participant.findOne({ _id: participantId, eventId });
  if (!participant) {
    throw new AppError('Participant not found for this event.', 404, 'NOT_FOUND');
  }

  // Check financial history
  const isPayer = await Expense.exists({ eventId, payerId: participantId });
  const isBeneficiary = await Expense.exists({
    eventId,
    'beneficiaries.participantId': participantId
  });
  const isSettlementPayer = await SettlementRecord.exists({ eventId, payerId: participantId });
  const isSettlementPayee = await SettlementRecord.exists({ eventId, payeeId: participantId });

  const hasFinancialHistory = isPayer || isBeneficiary || isSettlementPayer || isSettlementPayee;

  if (hasFinancialHistory) {
    participant.status = 'INACTIVE';
    await participant.save();
    await logAuditAction(eventId, 'PARTICIPANT_DEACTIVATED', 'Participant', participantId, {
      reason: 'Has existing financial history; deactivated to preserve audit integrity'
    });
    return {
      action: 'DEACTIVATED',
      participant,
      message: 'Participant has existing financial history and has been deactivated to preserve records.'
    };
  } else {
    // Zero financial history: safe to delete
    await Participant.deleteOne({ _id: participantId });
    await logAuditAction(eventId, 'PARTICIPANT_DEACTIVATED', 'Participant', participantId, {
      reason: 'No financial records; completely removed'
    });
    return {
      action: 'REMOVED',
      participantId,
      message: 'Participant had no financial transactions and has been permanently removed.'
    };
  }
}

module.exports = {
  addParticipant,
  listParticipants,
  deactivateParticipant
};
