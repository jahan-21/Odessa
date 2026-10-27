const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Participant = require('../models/Participant');
const SettlementRecord = require('../models/SettlementRecord');
const { logAuditAction } = require('./auditService');
const { AppError } = require('../middleware/errorHandler');
const { rupeesToPaise, formatRupees, paiseToRupees } = require('../core/money');
const {
  allocateExpenseShares,
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit
} = require('../core/splits');

/**
 * Validates that all participant IDs belong to the given event.
 */
async function validateParticipantsInEvent(eventId, participantIds) {
  const uniqueIds = [...new Set(participantIds.map(String))];
  const count = await Participant.countDocuments({
    _id: { $in: uniqueIds },
    eventId
  });

  if (count !== uniqueIds.length) {
    throw new AppError(
      'One or more selected participants do not belong to this event.',
      400,
      'INVALID_EVENT_PARTICIPANTS'
    );
  }
}

/**
 * Checks whether any completed settlement records exist for the event.
 * If yes, blocks modifications to expenses until settlements are reversed.
 */
async function assertNoActiveSettlements(eventId, actionName) {
  const hasActiveSettlements = await SettlementRecord.exists({
    eventId,
    status: 'COMPLETED'
  });

  if (hasActiveSettlements) {
    throw new AppError(
      `Cannot ${actionName} this expense: One or more completed settlement payments have already been recorded for this event. To maintain financial audit integrity, you must explicitly reverse conflicting settlement records before modifying expenses.`,
      409,
      'SETTLEMENT_LOCK_CONFLICT'
    );
  }
}

/**
 * Normalizes client payload into integer paise and calculates shares.
 */
function processExpensePayload(data) {
  const {
    description,
    amountRupees,
    amountPaise: rawPaise,
    payerId,
    splitMethod,
    category = 'GENERAL',
    beneficiaries = [],
    beneficiaryIds = [],
    notes
  } = data;

  if (!description || !description.trim()) {
    throw new AppError('Expense description is required.', 400, 'MISSING_DESCRIPTION');
  }
  if (!payerId) {
    throw new AppError('Payer ID is required.', 400, 'MISSING_PAYER');
  }
  if (!splitMethod) {
    throw new AppError('Split method is required (EQUAL, EXACT, or PERCENTAGE).', 400, 'MISSING_SPLIT_METHOD');
  }

  // Authoritative amount in paise
  let amountPaise;
  if (rawPaise !== undefined && rawPaise !== null) {
    if (!Number.isInteger(rawPaise) || rawPaise <= 0) {
      throw new AppError('amountPaise must be a positive integer.', 400, 'INVALID_AMOUNT');
    }
    amountPaise = rawPaise;
  } else if (amountRupees !== undefined && amountRupees !== null) {
    try {
      amountPaise = rupeesToPaise(amountRupees);
    } catch (err) {
      throw new AppError(err.message, 400, 'INVALID_AMOUNT');
    }
  } else {
    throw new AppError('Expense amount (in rupees or paise) is required.', 400, 'MISSING_AMOUNT');
  }

  // Prepare beneficiaries input for calculation engine
  let allocatedShares = [];

  try {
    if (splitMethod === 'EQUAL') {
      const ids = beneficiaryIds.length > 0 ? beneficiaryIds : beneficiaries.map(b => (typeof b === 'string' ? b : b.participantId));
      allocatedShares = calculateEqualSplit(amountPaise, ids);
    } else if (splitMethod === 'EXACT') {
      const formattedExact = beneficiaries.map(b => {
        let sharePaise = b.sharePaise;
        if (sharePaise === undefined && b.shareRupees !== undefined) {
          sharePaise = rupeesToPaise(b.shareRupees);
        }
        return {
          participantId: String(b.participantId),
          sharePaise: sharePaise,
          exactInputPaise: sharePaise
        };
      });
      allocatedShares = calculateExactSplit(amountPaise, formattedExact);
    } else if (splitMethod === 'PERCENTAGE') {
      const formattedPercentages = beneficiaries.map(b => {
        let bps = b.percentageBps;
        if (bps === undefined && b.percentage !== undefined) {
          bps = Math.round(Number(b.percentage) * 100);
        }
        return {
          participantId: String(b.participantId),
          percentageBps: bps
        };
      });
      allocatedShares = calculatePercentageSplit(amountPaise, formattedPercentages);
    } else {
      throw new AppError(`Unsupported split method: "${splitMethod}"`, 400, 'INVALID_SPLIT_METHOD');
    }
  } catch (calcError) {
    throw new AppError(calcError.message, 400, 'ALLOCATION_ERROR');
  }

  return {
    description: description.trim(),
    amountPaise,
    payerId: String(payerId),
    splitMethod,
    category: category.toUpperCase(),
    beneficiaries: allocatedShares,
    notes: notes ? notes.trim() : ''
  };
}

/**
 * Previews the split allocation without writing to the database.
 */
async function previewExpenseAllocation(eventId, data) {
  const processed = processExpensePayload(data);

  // Validate participants belong to event
  const participantIds = [processed.payerId, ...processed.beneficiaries.map(b => b.participantId)];
  await validateParticipantsInEvent(eventId, participantIds);

  const formattedBeneficiaries = processed.beneficiaries.map(b => ({
    ...b,
    shareRupees: formatRupees(b.sharePaise)
  }));

  const sumShares = processed.beneficiaries.reduce((acc, b) => acc + b.sharePaise, 0);

  return {
    description: processed.description,
    amountPaise: processed.amountPaise,
    amountRupeesFormatted: formatRupees(processed.amountPaise),
    payerId: processed.payerId,
    splitMethod: processed.splitMethod,
    category: processed.category,
    beneficiaries: formattedBeneficiaries,
    verification: {
      sumOfSharesPaise: sumShares,
      exactMatch: sumShares === processed.amountPaise
    }
  };
}

/**
 * Creates and records a new expense.
 */
async function createExpense(eventId, data) {
  await assertNoActiveSettlements(eventId, 'create a new expense on');

  const processed = processExpensePayload(data);

  // Validate participant membership
  const participantIds = [processed.payerId, ...processed.beneficiaries.map(b => b.participantId)];
  await validateParticipantsInEvent(eventId, participantIds);

  const expense = new Expense({
    eventId,
    ...processed
  });

  await expense.save();
  await logAuditAction(eventId, 'EXPENSE_CREATED', 'Expense', expense._id, {
    description: expense.description,
    amountPaise: expense.amountPaise,
    payerId: expense.payerId,
    splitMethod: expense.splitMethod
  });

  return expense.populate([
    { path: 'payerId', select: 'name email' },
    { path: 'beneficiaries.participantId', select: 'name email' }
  ]);
}

/**
 * Lists expenses for an event with pagination and filters.
 */
async function listExpenses(eventId, query = {}) {
  const { page = 1, limit = 25, category, payerId } = query;

  const filter = { eventId };
  if (category) filter.category = category.toUpperCase();
  if (payerId) filter.payerId = payerId;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [total, expenses] = await Promise.all([
    Expense.countDocuments(filter),
    Expense.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('payerId', 'name email')
      .populate('beneficiaries.participantId', 'name email')
      .lean()
  ]);

  const formattedExpenses = expenses.map(e => ({
    ...e,
    amountRupees: formatRupees(e.amountPaise),
    beneficiaries: e.beneficiaries.map(b => ({
      ...b,
      shareRupees: formatRupees(b.sharePaise)
    }))
  }));

  return {
    expenses: formattedExpenses,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Retrieves a single expense.
 */
async function getExpenseById(eventId, expenseId) {
  const expense = await Expense.findOne({ _id: expenseId, eventId })
    .populate('payerId', 'name email')
    .populate('beneficiaries.participantId', 'name email')
    .lean();

  if (!expense) {
    throw new AppError('Expense not found for this event.', 404, 'NOT_FOUND');
  }

  return {
    ...expense,
    amountRupees: formatRupees(expense.amountPaise),
    beneficiaries: expense.beneficiaries.map(b => ({
      ...b,
      shareRupees: formatRupees(b.sharePaise)
    }))
  };
}

/**
 * Updates an expense. Protected by settlement lock policy.
 */
async function updateExpense(eventId, expenseId, data) {
  await assertNoActiveSettlements(eventId, 'update');

  const existing = await Expense.findOne({ _id: expenseId, eventId });
  if (!existing) {
    throw new AppError('Expense not found for this event.', 404, 'NOT_FOUND');
  }

  const processed = processExpensePayload(data);

  const participantIds = [processed.payerId, ...processed.beneficiaries.map(b => b.participantId)];
  await validateParticipantsInEvent(eventId, participantIds);

  Object.assign(existing, processed);
  await existing.save();

  await logAuditAction(eventId, 'EXPENSE_UPDATED', 'Expense', existing._id, {
    description: existing.description,
    amountPaise: existing.amountPaise
  });

  return existing.populate([
    { path: 'payerId', select: 'name email' },
    { path: 'beneficiaries.participantId', select: 'name email' }
  ]);
}

/**
 * Deletes an expense. Protected by settlement lock policy.
 */
async function deleteExpense(eventId, expenseId) {
  await assertNoActiveSettlements(eventId, 'delete');

  const expense = await Expense.findOneAndDelete({ _id: expenseId, eventId });
  if (!expense) {
    throw new AppError('Expense not found for this event.', 404, 'NOT_FOUND');
  }

  await logAuditAction(eventId, 'EXPENSE_DELETED', 'Expense', expenseId, {
    description: expense.description,
    amountPaise: expense.amountPaise
  });

  return {
    deleted: true,
    expenseId,
    message: 'Expense successfully removed.'
  };
}

module.exports = {
  previewExpenseAllocation,
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense
};
