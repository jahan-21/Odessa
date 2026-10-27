const Event = require('../models/Event');
const Participant = require('../models/Participant');
const Expense = require('../models/Expense');
const SettlementRecord = require('../models/SettlementRecord');
const { logAuditAction } = require('./auditService');
const { AppError } = require('../middleware/errorHandler');

async function createEvent(data) {
  const { name, description, currency = 'INR' } = data;
  if (!name || !name.trim()) {
    throw new AppError('Event name is required.', 400, 'MISSING_NAME');
  }

  const event = new Event({
    name: name.trim(),
    description: description ? description.trim() : '',
    currency: currency.toUpperCase()
  });

  await event.save();
  await logAuditAction(event._id, 'EVENT_CREATED', 'Event', event._id, { name: event.name });
  return event;
}

async function listEvents() {
  return Event.find().sort({ createdAt: -1 }).lean();
}

async function getEventById(eventId) {
  const event = await Event.findById(eventId).lean();
  if (!event) {
    throw new AppError(`Event with ID "${eventId}" not found.`, 404, 'EVENT_NOT_FOUND');
  }

  const participantsCount = await Participant.countDocuments({ eventId, status: 'ACTIVE' });
  const expensesCount = await Expense.countDocuments({ eventId });
  const settlementsCount = await SettlementRecord.countDocuments({ eventId, status: 'COMPLETED' });

  return {
    ...event,
    stats: {
      participantsCount,
      expensesCount,
      settlementsCount
    }
  };
}

/**
 * Seeds the exact Campus Hire Case Study Demo Event:
 * Participants: Asha, Bala, Charan
 * Resulting balances:
 * - Asha: +₹600.00
 * - Bala: +₹150.00
 * - Charan: -₹750.00
 * Settlement:
 * - Charan pays Asha ₹600.00
 * - Charan pays Bala ₹150.00
 */
async function seedDemoEvent() {
  // 1. Create Demo Event
  const event = new Event({
    name: 'Hackathon 2026 — Case Study Demo',
    description: 'Demonstration event matching the Campus Hire Case Study requirements: Asha (+₹600), Bala (+₹150), Charan (-₹750).',
    currency: 'INR'
  });
  await event.save();

  // 2. Add Participants
  const asha = new Participant({ eventId: event._id, name: 'Asha', email: 'asha@campus.edu' });
  const bala = new Participant({ eventId: event._id, name: 'Bala', email: 'bala@campus.edu' });
  const charan = new Participant({ eventId: event._id, name: 'Charan', email: 'charan@campus.edu' });

  await Promise.all([asha.save(), bala.save(), charan.save()]);

  // 3. Add Expenses:
  // Expense 1: Asha pays ₹900.00 (90,000 paise).
  // Beneficiaries: Asha (30000), Bala (30000), Charan (30000).
  const exp1 = new Expense({
    eventId: event._id,
    description: 'Team Dinner & Refreshments',
    amountPaise: 90000,
    payerId: asha._id,
    splitMethod: 'EQUAL',
    category: 'FOOD',
    beneficiaries: [
      { participantId: asha._id, sharePaise: 30000 },
      { participantId: bala._id, sharePaise: 30000 },
      { participantId: charan._id, sharePaise: 30000 }
    ],
    notes: 'Dinner at Bistro after day 1 presentations'
  });

  // Expense 2: Bala pays ₹600.00 (60,000 paise).
  // Beneficiaries: Bala (15000), Charan (45000). (Asha not a beneficiary!)
  // Net calculation:
  // Asha: Paid 90000, Share 30000 -> Net +60000 (+₹600.00)
  // Bala: Paid 60000, Share (30000 + 15000 = 45000) -> Net +15000 (+₹150.00)
  // Charan: Paid 0, Share (30000 + 45000 = 75000) -> Net -75000 (-₹750.00)
  const exp2 = new Expense({
    eventId: event._id,
    description: 'Project Supplies & Late-Night Cab',
    amountPaise: 60000,
    payerId: bala._id,
    splitMethod: 'EXACT',
    category: 'SUPPLIES',
    beneficiaries: [
      { participantId: bala._id, sharePaise: 15000 },
      { participantId: charan._id, sharePaise: 45000 }
    ],
    notes: 'Hardware sensors and travel for Charan and Bala'
  });

  await Promise.all([exp1.save(), exp2.save()]);

  await logAuditAction(event._id, 'EVENT_CREATED', 'Event', event._id, { seeded: true });

  return {
    eventId: event._id,
    event,
    participants: [asha, bala, charan],
    expenses: [exp1, exp2]
  };
}

module.exports = {
  createEvent,
  listEvents,
  getEventById,
  seedDemoEvent
};
