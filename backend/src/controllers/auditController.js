const auditService = require('../services/auditService');

async function getEventAuditHistory(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const history = await auditService.getEventAuditHistory(req.params.eventId, limit);
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getEventAuditHistory
};
