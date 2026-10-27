const express = require('express');
const router = express.Router({ mergeParams: true });
const balanceController = require('../../controllers/balanceController');
const { validateObjectId } = require('../../middleware/validate');

router.get('/', validateObjectId('eventId'), balanceController.getEventBalances);
router.get(
  '/:participantId/explain',
  validateObjectId('eventId'),
  validateObjectId('participantId'),
  balanceController.explainParticipantBalance
);

module.exports = router;
