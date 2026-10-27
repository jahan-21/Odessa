const express = require('express');
const router = express.Router({ mergeParams: true });
const settlementController = require('../../controllers/settlementController');
const { validateObjectId } = require('../../middleware/validate');

router.get('/proposed', validateObjectId('eventId'), settlementController.getProposedSettlements);
router.post('/record', validateObjectId('eventId'), settlementController.recordSettlement);
router.get('/history', validateObjectId('eventId'), settlementController.listSettlementHistory);
router.post(
  '/:settlementId/reverse',
  validateObjectId('eventId'),
  validateObjectId('settlementId'),
  settlementController.reverseSettlement
);

module.exports = router;
