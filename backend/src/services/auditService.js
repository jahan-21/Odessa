const AuditRecord = require('../models/AuditRecord');

async function logAuditAction(eventId, action, entityType, entityId, details = null) {
  try {
    const record = new AuditRecord({
      eventId,
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date()
    });
    await record.save();
    return record;
  } catch (err) {
    // Non-blocking logger error, but report to console
    console.error(`[Audit Log Failed] ${action} on ${entityType}: ${err.message}`);
    return null;
  }
}

async function getEventAuditHistory(eventId, limit = 100) {
  return AuditRecord.find({ eventId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  logAuditAction,
  getEventAuditHistory
};
