const participantService = require('../services/participantService');

async function addParticipant(req, res, next) {
  try {
    const participant = await participantService.addParticipant(req.params.eventId, req.body);
    res.status(201).json({
      success: true,
      data: participant
    });
  } catch (err) {
    next(err);
  }
}

async function listParticipants(req, res, next) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const participants = await participantService.listParticipants(req.params.eventId, includeInactive);
    res.status(200).json({
      success: true,
      data: participants
    });
  } catch (err) {
    next(err);
  }
}

async function deactivateParticipant(req, res, next) {
  try {
    const result = await participantService.deactivateParticipant(
      req.params.eventId,
      req.params.participantId
    );
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  addParticipant,
  listParticipants,
  deactivateParticipant
};
