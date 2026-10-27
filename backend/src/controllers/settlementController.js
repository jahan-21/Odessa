const settlementService = require('../services/settlementService');

async function getProposedSettlements(req, res, next) {
  try {
    const result = await settlementService.getProposedSettlements(req.params.eventId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function recordSettlement(req, res, next) {
  try {
    const record = await settlementService.recordSettlement(req.params.eventId, req.body);
    res.status(201).json({
      success: true,
      message: 'Settlement payment recorded successfully.',
      data: record
    });
  } catch (err) {
    next(err);
  }
}

async function listSettlementHistory(req, res, next) {
  try {
    const history = await settlementService.listSettlementHistory(req.params.eventId);
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (err) {
    next(err);
  }
}

async function reverseSettlement(req, res, next) {
  try {
    const record = await settlementService.reverseSettlement(
      req.params.eventId,
      req.params.settlementId,
      req.body.reason
    );
    res.status(200).json({
      success: true,
      message: 'Settlement transaction successfully reversed.',
      data: record
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProposedSettlements,
  recordSettlement,
  listSettlementHistory,
  reverseSettlement
};
