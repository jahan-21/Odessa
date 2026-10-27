const express = require('express');
const router = express.Router();
const eventController = require('../../controllers/eventController');
const { validateObjectId } = require('../../middleware/validate');

router.post('/', eventController.createEvent);
router.get('/', eventController.listEvents);
router.post('/seed-demo', eventController.seedDemoEvent);
router.get('/:eventId', validateObjectId('eventId'), eventController.getEventById);

module.exports = router;
