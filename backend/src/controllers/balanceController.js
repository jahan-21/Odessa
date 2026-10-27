const balanceService = require('../services/balanceService');

async function getEventBalances(req, res, next) {
  try {
    const balances = await balanceService.getEventBalances(req.params.eventId);
    res.status(200).json({
      success: true,
      data: balances
    });
  } catch (err) {
    next(err);
  }
}

async function explainParticipantBalance(req, res, next) {
  try {
    const explanation = await balanceService.explainParticipantBalance(
      req.params.eventId,
      req.params.participantId
    );
    res.status(200).json({
      success: true,
      data: explanation
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getEventBalances,
  explainParticipantBalance
};
