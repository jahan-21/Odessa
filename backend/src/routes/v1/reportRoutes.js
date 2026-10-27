const express = require('express');
const router = express.Router({ mergeParams: true });
const reportController = require('../../controllers/reportController');
const { validateObjectId } = require('../../middleware/validate');

router.get('/reconciliation', validateObjectId('eventId'), reportController.getReconciliationReport);
router.get('/export/csv', validateObjectId('eventId'), reportController.exportEventCSV);

module.exports = router;
