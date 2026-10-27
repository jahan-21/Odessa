const express = require('express');
const router = express.Router({ mergeParams: true });
const auditController = require('../../controllers/auditController');
const { validateObjectId } = require('../../middleware/validate');

router.get('/', validateObjectId('eventId'), auditController.getEventAuditHistory);

module.exports = router;
